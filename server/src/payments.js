// Paystack payment routes: initialize, webhook, status
import crypto from 'crypto';
import db from './db.js';
import { authRequired } from './auth.js';
import { getRide } from './ridecore.js';
import { emitToUser } from './state.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';

// Webhook must be registered BEFORE express.json() so we get the raw body
export function registerPaystackWebhook(app) {
  app.post('/api/payments/paystack/webhook', (req, res, next) => {
    // Collect raw body
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      const rawBody = Buffer.concat(chunks);
      try {
        const signature = req.headers['x-paystack-signature'];
        if (!signature || !PAYSTACK_SECRET) return res.status(400).send('Missing signature');

        // Verify HMAC SHA-512
        const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');
        if (hash !== signature) return res.status(401).send('Invalid signature');

        const event = JSON.parse(rawBody.toString());
        if (event.event !== 'charge.success') return res.status(200).send('Ignored');

        const { reference } = event.data;
        if (!reference) return res.status(200).send('No reference');

        // Idempotency: check if already paid
        const payment = db.prepare('SELECT * FROM payments WHERE paystack_reference = ?').get(reference);
        if (!payment) return res.status(200).send('Payment not found');
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

        // Mark as paid
        db.prepare(`
          UPDATE payments SET status = 'PAID', paystack_transaction_id = ?, paid_at = datetime('now')
          WHERE paystack_reference = ?
        `).run(verifyData.data.id, reference);

        // Notify driver via WebSocket
        emitToUser(payment.driver_id, 'payment:confirmed', {
          tripId: payment.trip_id,
          amount: payment.amount_kobo / 100,
          driverEarnings: payment.driver_earnings_kobo / 100,
          reference,
        });

        res.status(200).send('Payment confirmed');
      } catch (err) {
        console.error('Paystack webhook error:', err);
        res.status(500).send('Webhook error');
      }
    });
  });
}

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
      // Commission only on fare (10%), tip goes 100% to driver
      const commissionKobo = Math.round(fareKobo * 0.10);
      const driverEarningsKobo = (fareKobo - commissionKobo) + tipKobo;
      // Add random suffix to guarantee uniqueness across retries
      const reference = `muve_trip_${tripId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Create fresh pending payment record (amount_kobo = fare + tip)
      db.prepare(`
        INSERT INTO payments (trip_id, rider_id, driver_id, paystack_reference, amount_kobo, commission_kobo, driver_earnings_kobo, status)
        VALUES (?,?,?,?,?,?,?, 'PENDING')
      `).run(tripId, ride.rider_id, ride.driver_id, reference, totalKobo, commissionKobo, driverEarningsKobo);

      // Don't call Paystack's initialize API here — the frontend's PaystackPop.setup()
      // will create the transaction with this reference. Calling initialize here too
      // causes "Duplicate Transaction Reference" errors.
      res.json({
        reference,
        amountKobo: totalKobo,
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
  // This does the same verification as the webhook — caller passes the reference
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
      // (Paystack's API may not have the transaction marked as success immediately after popup callback)
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

      // Mark as paid
      db.prepare(`
        UPDATE payments SET status = 'PAID', paystack_transaction_id = ?, paid_at = datetime('now')
        WHERE paystack_reference = ?
      `).run(verifyData.data.id, reference);

      // Save tip on the ride record (tip = total paid - fare)
      const fareKobo = Math.round(getRide(payment.trip_id).fare * 100);
      const tipKobo = payment.amount_kobo - fareKobo;
      if (tipKobo > 0) {
        db.prepare('UPDATE rides SET tip = ? WHERE id = ?').run(tipKobo / 100, payment.trip_id);
      }

      // Notify driver via WebSocket
      emitToUser(payment.driver_id, 'payment:confirmed', {
        tripId: payment.trip_id,
        amount: payment.amount_kobo / 100,
        driverEarnings: payment.driver_earnings_kobo / 100,
        reference,
      });

      res.json({ status: 'PAID' });
    } catch (err) {
      console.error('Paystack verify error:', err);
      res.status(500).json({ error: 'Verification failed' });
    }
  });
}
