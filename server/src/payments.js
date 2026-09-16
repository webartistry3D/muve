// Paystack payment routes: initialize, webhook, status, settlement
import crypto from 'crypto';
import db from './db.js';
import { authRequired } from './auth.js';
import { getRide } from './ridecore.js';
import { emitToUser } from './state.js';
import { creditWallet, debitWallet } from './wallet.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';

const COMMISSION_KOBO = 100000; // ₦1,000 in kobo
const CYCLE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Settlement: calculate commission + credit driver atomically ──────────────
// Returns { commissionKobo, driverEarningsKobo } or null if already settled
function settlePayment(payment) {
  const driver = db.prepare('SELECT commission_cycle_started_at FROM users WHERE id = ?').get(payment.driver_id);
  const now = Date.now();
  const cycleStart = driver.commission_cycle_started_at ? new Date(driver.commission_cycle_started_at + 'Z').getTime() : 0;
  const cycleExpired = !cycleStart || (now - cycleStart) >= CYCLE_MS;

  // Commission only on fare (amount_kobo includes tip, but commission is on fare only)
  // payment.amount_kobo = fare + tip; payment.commission_kobo was set at init time
  // Recalculate here for safety — fare from ride record
  const ride = getRide(payment.trip_id);
  const fareKobo = Math.round(ride.fare * 100);
  const tipKobo = payment.amount_kobo - fareKobo;

  let commissionKobo;
  if (cycleExpired) {
    commissionKobo = Math.min(COMMISSION_KOBO, fareKobo);
  } else {
    commissionKobo = 0;
  }
  const driverEarningsKobo = (fareKobo - commissionKobo) + tipKobo;

  const settle = db.transaction(() => {
    // Mark payment as PAID
    db.prepare(`
      UPDATE payments SET status = 'PAID', paystack_transaction_id = ?, commission_kobo = ?, driver_earnings_kobo = ?, paid_at = datetime('now')
      WHERE paystack_reference = ? AND status != 'PAID'
    `).run(payment.paystack_transaction_id, commissionKobo, driverEarningsKobo, payment.paystack_reference);

    // Update commission cycle if this trip triggered a deduction
    if (commissionKobo > 0) {
      db.prepare('UPDATE users SET commission_cycle_started_at = datetime(\'now\') WHERE id = ?')
        .run(payment.driver_id);
    }

    // Credit full fare + tip, then debit commission separately (for audit trail)
    creditWallet(payment.driver_id, (fareKobo + tipKobo) / 100, `Trip #${payment.trip_id} earning`, payment.trip_id, 'TRIP_EARNING');
    if (commissionKobo > 0) {
      creditWallet(payment.driver_id, -(commissionKobo / 100), `Muve daily fee (Trip #${payment.trip_id})`, payment.trip_id, 'MUVE_COMMISSION');
    }
  });

  settle();
  return { commissionKobo, driverEarningsKobo };
}

// ── Webhook ──────────────────────────────────────────────────────────────────
// Must be registered BEFORE express.json() so we get the raw body
export function registerPaystackWebhook(app) {
  app.post('/api/payments/paystack/webhook', (req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      const rawBody = Buffer.concat(chunks);
      try {
        const signature = req.headers['x-paystack-signature'];
        if (!signature || !PAYSTACK_SECRET) return res.status(400).send('Missing signature');

        const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');
        if (hash !== signature) return res.status(401).send('Invalid signature');

        const event = JSON.parse(rawBody.toString());

        // ── Handle charge.success (trip payments + DVA wallet funding) ──
        if (event.event === 'charge.success') {
          const { reference } = event.data;
          if (!reference) return res.status(200).send('No reference');

          const payment = db.prepare('SELECT * FROM payments WHERE paystack_reference = ?').get(reference);

          // Not a trip payment — check if it's a DVA wallet funding
          if (!payment) {
            const channel = event.data.channel;
            const custCode = event.data.customer?.customer_code;
            if (channel === 'dedicated_account' || (event.data.metadata && event.data.metadata.wallet_fund)) {
              const user = custCode
                ? db.prepare('SELECT id FROM users WHERE paystack_customer_code = ?').get(custCode)
                : null;
              if (user) {
                const amount = event.data.amount / 100;
                const balance = creditWallet(user.id, amount, 'Wallet funding via bank transfer', null, 'WALLET_FUND');
                emitToUser(user.id, 'wallet:funded', { amount, balance });
              }
            }
            return res.status(200).send('Payment not found');
          }

          // Idempotency: already settled
          if (payment.status === 'PAID') return res.status(200).send('Already processed');

          // Re-verify via Paystack API
          const verifyResp = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
            headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` },
          });
          const verifyData = await verifyResp.json();

          if (!verifyData.status || verifyData.data.status !== 'success') {
            db.prepare('UPDATE payments SET status = ? WHERE paystack_reference = ?').run('FAILED', reference);
            return res.status(200).send('Payment not successful');
          }

          // Validate amount and currency
          if (verifyData.data.amount !== payment.amount_kobo) {
            db.prepare('UPDATE payments SET status = ? WHERE paystack_reference = ?').run('FAILED', reference);
            return res.status(200).send('Amount mismatch');
          }
          if (verifyData.data.currency !== 'NGN') {
            db.prepare('UPDATE payments SET status = ? WHERE paystack_reference = ?').run('FAILED', reference);
            return res.status(200).send('Currency mismatch');
          }

          // Settle atomically
          payment.paystack_transaction_id = verifyData.data.id;
          const result = settlePayment(payment);

          // Notify driver via WebSocket
          emitToUser(payment.driver_id, 'payment:confirmed', {
            tripId: payment.trip_id,
            amount: payment.amount_kobo / 100,
            driverEarnings: result.driverEarningsKobo / 100,
            commission: result.commissionKobo / 100,
            reference,
          });

          return res.status(200).send('Payment confirmed');
        }

        // ── Handle transfer status events (withdrawals) ──
        if (event.event === 'transfer.success' || event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
          const transferCode = event.data?.transfer_code;
          if (!transferCode) return res.status(200).send('No transfer code');

          const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE paystack_transfer_code = ?').get(transferCode);
          if (!withdrawal) return res.status(200).send('Withdrawal not found');

          if (event.event === 'transfer.success') {
            const markComplete = db.transaction(() => {
              db.prepare("UPDATE withdrawals SET status = 'COMPLETED', updated_at = datetime('now') WHERE id = ? AND status = 'PENDING'")
                .run(withdrawal.id);
            });
            markComplete();
            emitToUser(withdrawal.user_id, 'withdrawal:completed', { id: withdrawal.id, amount: withdrawal.amount });
          } else {
            // failed or reversed — refund the wallet
            const reverse = db.transaction(() => {
              db.prepare("UPDATE withdrawals SET status = 'REVERSED', updated_at = datetime('now') WHERE id = ? AND status = 'PENDING'")
                .run(withdrawal.id);
              creditWallet(withdrawal.user_id, withdrawal.amount, `Withdrawal reversed`, null, 'WITHDRAWAL_REVERSAL');
            });
            reverse();
            emitToUser(withdrawal.user_id, 'withdrawal:reversed', { id: withdrawal.id, amount: withdrawal.amount });
          }

          return res.status(200).send('Transfer status processed');
        }

        return res.status(200).send('Ignored');
      } catch (err) {
        console.error('Paystack webhook error:', err);
        res.status(500).send('Webhook error');
      }
    });
  });
}

// ── Payment REST routes ──────────────────────────────────────────────────────
export function registerPaymentRoutes(app) {
  // Initialize a Paystack transaction for a completed trip
  app.post('/api/payments/paystack/initialize', authRequired, async (req, res) => {
    try {
      if (!PAYSTACK_SECRET) return res.status(500).json({ error: 'Paystack not configured' });
      const { tripId, tip } = req.body || {};
      if (!tripId) return res.status(400).json({ error: 'tripId required' });

      const ride = getRide(tripId);
      if (!ride) return res.status(404).json({ error: 'Trip not found' });
      if (ride.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your trip' });
      if (ride.status !== 'completed') return res.status(400).json({ error: 'Trip must be completed' });

      // Check for existing paid payment
      const existing = db.prepare('SELECT * FROM payments WHERE trip_id = ? AND status = ?').get(tripId, 'PAID');
      if (existing) return res.status(409).json({ error: 'Trip already paid' });

      // Mark old PENDING payments for this trip as FAILED (so we can start fresh)
      db.prepare('UPDATE payments SET status = ? WHERE trip_id = ? AND status = ?').run('FAILED', tripId, 'PENDING');

      const tipAmount = Number(tip) || 0;
      const fareKobo = Math.round(ride.fare * 100);
      const tipKobo = Math.round(tipAmount * 100);
      const totalKobo = fareKobo + tipKobo;
      // Commission is calculated at settlement time (₦1,000/24h rule), not here.
      // Store 0 for now; settlePayment() will update with the real value.
      const reference = `muve_trip_${tripId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      db.prepare(`
        INSERT INTO payments (trip_id, rider_id, driver_id, paystack_reference, amount_kobo, commission_kobo, driver_earnings_kobo, status)
        VALUES (?,?,?,?,?,?,?, 'PENDING')
      `).run(tripId, ride.rider_id, ride.driver_id, reference, totalKobo, 0, 0);

      res.json({
        reference,
        amountKobo: totalKobo,
        tripId,
        riderId: ride.rider_id,
        driverId: ride.driver_id,
      });
    } catch (err) {
      console.error('Paystack init error:', err);
      res.status(500).json({ error: 'Payment initialization failed' });
    }
  });

  // Get rider's unpaid completed trips
  app.get('/api/payments/unpaid', authRequired, (req, res) => {
    if (req.user.role !== 'rider') return res.status(403).json({ error: 'Riders only' });
    const trips = db.prepare(`
      SELECT r.id, r.fare, r.tip, r.distance_m, r.duration_s, r.drop_addr, r.completed_at,
             r.driver_id, u.name as driver_name
      FROM rides r
      LEFT JOIN payments p ON p.trip_id = r.id AND p.status = 'PAID'
      JOIN users u ON u.id = r.driver_id
      WHERE r.rider_id = ? AND r.status = 'completed' AND p.id IS NULL
      ORDER BY r.id DESC
    `).all(req.user.id);
    res.json({ trips });
  });

  // Payment status for a trip
  app.get('/api/payments/:tripId/status', authRequired, (req, res) => {
    const ride = getRide(req.params.tripId);
    if (!ride) return res.status(404).json({ error: 'Trip not found' });
    if (ride.rider_id !== req.user.id && ride.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const payment = db.prepare('SELECT * FROM payments WHERE trip_id = ? ORDER BY id DESC LIMIT 1').get(req.params.tripId);
    if (!payment) return res.json({ status: null });
    res.json({
      status: payment.status,
      reference: payment.paystack_reference,
      amount: payment.amount_kobo / 100,
      paidAt: payment.paid_at,
    });
  });

  // Verify a Paystack transaction (used when webhook can't reach server, e.g. localhost)
  app.post('/api/payments/paystack/verify', authRequired, async (req, res) => {
    try {
      if (!PAYSTACK_SECRET) return res.status(500).json({ error: 'Paystack not configured' });
      const { reference } = req.body || {};
      if (!reference) return res.status(400).json({ error: 'reference required' });

      const payment = db.prepare('SELECT * FROM payments WHERE paystack_reference = ?').get(reference);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      if (payment.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your payment' });
      if (payment.status === 'PAID') return res.json({ status: 'PAID' });

      // Verify via Paystack API — retry up to 3 times with delay
      let verifyData = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        const verifyResp = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
          headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` },
        });
        verifyData = await verifyResp.json();
        console.log(`Paystack verify attempt ${attempt + 1}:`, verifyData.status, verifyData.data?.status);
        if (verifyData.status && verifyData.data?.status === 'success') break;
      }

      if (!verifyData || !verifyData.status || verifyData.data.status !== 'success') {
        console.error('Paystack verification failed after retries:', JSON.stringify(verifyData));
        return res.json({ status: 'FAILED' });
      }
      if (verifyData.data.amount !== payment.amount_kobo) {
        console.error('Amount mismatch:', verifyData.data.amount, 'vs', payment.amount_kobo);
        db.prepare('UPDATE payments SET status = ? WHERE paystack_reference = ?').run('FAILED', reference);
        return res.json({ status: 'FAILED' });
      }

      // Save tip on the ride record (tip = total paid - fare)
      const fareKobo = Math.round(getRide(payment.trip_id).fare * 100);
      const tipKobo = payment.amount_kobo - fareKobo;
      if (tipKobo > 0) {
        db.prepare('UPDATE rides SET tip = ? WHERE id = ?').run(tipKobo / 100, payment.trip_id);
      }

      // Settle atomically
      payment.paystack_transaction_id = verifyData.data.id;
      const result = settlePayment(payment);

      // Notify driver via WebSocket
      emitToUser(payment.driver_id, 'payment:confirmed', {
        tripId: payment.trip_id,
        amount: payment.amount_kobo / 100,
        driverEarnings: result.driverEarningsKobo / 100,
        commission: result.commissionKobo / 100,
        reference,
      });

      res.json({ status: 'PAID' });
    } catch (err) {
      console.error('Paystack verify error:', err);
      res.status(500).json({ error: 'Verification failed' });
    }
  });
}
