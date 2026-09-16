// Driver wallet: balance, transactions, fund via Paystack DVA, withdraw via Paystack Transfer.
import crypto from 'crypto';
import db from './db.js';
import { authRequired } from './auth.js';
import { emitToUser } from './state.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';

// Ensure a wallet row exists for a user
function ensureWallet(userId) {
  db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance) VALUES (?, 0)').run(userId);
  return db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
}

// Credit a driver's wallet (called when a payment is confirmed or a transfer lands)
// type: TRIP_EARNING, MUVE_COMMISSION, WALLET_FUND, WITHDRAWAL_REVERSAL, ADJUSTMENT
export function creditWallet(userId, amount, description, rideId = null, type = 'credit') {
  ensureWallet(userId);
  const tx = db.transaction(() => {
    db.prepare('UPDATE wallets SET balance = balance + ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(amount, userId);
    db.prepare('INSERT INTO wallet_transactions (user_id, type, amount, description, ride_id) VALUES (?, ?, ?, ?, ?)').run(userId, type, amount, description, rideId);
  });
  tx();
  return db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId).balance;
}

// Debit a driver's wallet (used for withdrawals)
export function debitWallet(userId, amount, description, type = 'WITHDRAWAL') {
  ensureWallet(userId);
  const tx = db.transaction(() => {
    db.prepare('UPDATE wallets SET balance = balance - ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(amount, userId);
    db.prepare('INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)').run(userId, type, -amount, description);
  });
  tx();
  return db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId).balance;
}

export function registerWalletRoutes(app) {
  // Get wallet balance + recent transactions
  app.get('/api/wallet', authRequired, (req, res) => {
    const wallet = ensureWallet(req.user.id);
    const transactions = db.prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
    res.json({
      balance: wallet.balance,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        rideId: t.ride_id,
        date: t.created_at,
      })),
    });
  });

  // Create / retrieve Paystack dedicated virtual account for funding
  app.post('/api/wallet/fund', authRequired, async (req, res) => {
    if (!PAYSTACK_SECRET) return res.status(500).json({ error: 'Paystack not configured' });
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

      // Step 1: Create Paystack customer if not exists
      let customerCode = user.paystack_customer_code;
      if (!customerCode) {
        const custResp = await fetch(`${PAYSTACK_BASE}/customer`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            first_name: user.name.split(' ')[0] || '',
            last_name: user.name.split(' ').slice(1).join(' ') || '',
          }),
        });
        const custData = await custResp.json();
        if (!custData.status) return res.status(400).json({ error: 'Could not create Paystack customer' });
        customerCode = custData.data.customer_code;
        db.prepare('UPDATE users SET paystack_customer_code = ? WHERE id = ?').run(customerCode, req.user.id);
      }

      // Step 2: Create dedicated virtual account if not exists
      let accountNumber = user.paystack_account_number;
      let bankName = user.paystack_bank_name;
      if (!accountNumber) {
        const accResp = await fetch(`${PAYSTACK_BASE}/dedicated_account`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer: customerCode }),
        });
        const accData = await accResp.json();
        if (!accData.status) return res.status(400).json({ error: 'Could not create virtual account' });
        accountNumber = accData.data.account_number;
        bankName = accData.data.bank.name;
        db.prepare('UPDATE users SET paystack_account_number = ?, paystack_bank_name = ? WHERE id = ?')
          .run(accountNumber, bankName, req.user.id);
      }

      res.json({ accountNumber, bankName });
    } catch (err) {
      console.error('Wallet fund error:', err);
      res.status(500).json({ error: 'Could not generate account details' });
    }
  });

  // Get existing virtual account (if already created)
  app.get('/api/wallet/account', authRequired, (req, res) => {
    const user = db.prepare('SELECT paystack_account_number, paystack_bank_name FROM users WHERE id = ?').get(req.user.id);
    if (!user?.paystack_account_number) return res.json({ accountNumber: null, bankName: null });
    res.json({ accountNumber: user.paystack_account_number, bankName: user.paystack_bank_name });
  });

  // Withdraw to bank account via Paystack Transfer API
  // Flow: reserve funds → create/reuse recipient → initiate transfer → mark PENDING
  // Transfer status webhook will mark COMPLETED or REVERSED
  app.post('/api/wallet/withdraw', authRequired, async (req, res) => {
    if (!PAYSTACK_SECRET) return res.status(500).json({ error: 'Paystack not configured' });
    const { amount, accountNumber, bankCode } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Valid amount required' });
    if (amt < 1000) return res.status(400).json({ error: 'Minimum withdrawal is ₦1,000' });
    if (!accountNumber || !bankCode) return res.status(400).json({ error: 'Bank account required' });

    ensureWallet(req.user.id);
    const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);
    if (wallet.balance < amt) return res.status(400).json({ error: 'Insufficient balance' });

    // Find saved bank account to reuse recipient code
    const bankAcct = db.prepare('SELECT * FROM driver_bank_accounts WHERE user_id = ? AND account_number = ? AND bank_code = ?')
      .get(req.user.id, accountNumber, bankCode);

    try {
      // Step 1: Get or create transfer recipient
      let recipientCode = bankAcct?.paystack_recipient_code;
      if (!recipientCode) {
        const recipientResp = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nuban',
            name: req.user.name,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN',
          }),
        });
        const recipientData = await recipientResp.json();
        if (!recipientData.status) {
          const msg = recipientData.message || 'Could not resolve bank account';
          console.error('Paystack transferrecipient error:', recipientData);
          return res.status(400).json({ error: msg });
        }
        recipientCode = recipientData.data.recipient_code;
        // Store recipient code on the bank account row if we have one
        if (bankAcct) {
          db.prepare('UPDATE driver_bank_accounts SET paystack_recipient_code = ? WHERE id = ?').run(recipientCode, bankAcct.id);
        }
      }

      // Step 2: Initiate transfer
      const transferResp = await fetch(`${PAYSTACK_BASE}/transfer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'balance',
          amount: Math.round(amt * 100),
          recipient: recipientCode,
          reason: 'Muve wallet withdrawal',
        }),
      });
      const transferData = await transferResp.json();
      if (!transferData.status) {
        const msg = transferData.message || 'Transfer failed';
        console.error('Paystack transfer error:', transferData);
        return res.status(400).json({ error: msg });
      }

      const transferCode = transferData.data.transfer_code;
      const reference = `muve_wd_${req.user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Step 3: Reserve funds + record withdrawal + log transaction (atomic)
      const tx = db.transaction(() => {
        // Debit wallet immediately (funds are reserved)
        db.prepare('UPDATE wallets SET balance = balance - ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(amt, req.user.id);
        // Log withdrawal transaction
        db.prepare('INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)')
          .run(req.user.id, 'WITHDRAWAL', -amt, `Withdrawal to ${accountNumber}`);
        // Create withdrawal record
        db.prepare(`
          INSERT INTO withdrawals (user_id, amount, bank_name, account_number, paystack_transfer_code, paystack_recipient_code, status, reference)
          VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
        `).run(req.user.id, amt, bankAcct?.bank_name || '', accountNumber, transferCode, recipientCode, reference);
      });
      tx();

      const balance = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(req.user.id).balance;
      res.json({ ok: true, balance, transferCode, status: 'PENDING' });
    } catch (err) {
      console.error('Wallet withdraw error:', err);
      res.status(500).json({ error: 'Withdrawal failed' });
    }
  });

  // List Nigerian banks for withdrawal
  app.get('/api/wallet/banks', authRequired, async (_req, res) => {
    if (!PAYSTACK_SECRET) return res.status(500).json({ error: 'Paystack not configured' });
    try {
      const resp = await fetch(`${PAYSTACK_BASE}/bank`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const data = await resp.json();
      const banks = data.data
        .filter((b) => b.country === 'Nigeria')
        .map((b) => ({ name: b.name, code: b.code }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json({ banks });
    } catch {
      res.status(500).json({ error: 'Could not fetch banks' });
    }
  });

  // List all saved bank accounts
  app.get('/api/wallet/bank-accounts', authRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM driver_bank_accounts WHERE user_id = ? ORDER BY id').all(req.user.id);
    res.json({
      bankAccounts: rows.map((a) => ({
        id: a.id,
        bankCode: a.bank_code,
        bankName: a.bank_name,
        accountNumber: a.account_number,
        accountName: a.account_name,
      })),
    });
  });

  // Add a bank account (max 3)
  app.post('/api/wallet/bank-accounts', authRequired, (req, res) => {
    const { bankCode, bankName, accountNumber, accountName } = req.body || {};
    if (!bankCode || !bankName || !accountNumber) return res.status(400).json({ error: 'Bank and account number required' });
    if (String(accountNumber).length !== 10) return res.status(400).json({ error: 'Account number must be 10 digits' });

    const count = db.prepare('SELECT COUNT(*) as c FROM driver_bank_accounts WHERE user_id = ?').get(req.user.id).c;
    if (count >= 3) return res.status(400).json({ error: 'Maximum of 3 bank accounts allowed' });

    db.prepare('INSERT INTO driver_bank_accounts (user_id, bank_code, bank_name, account_number, account_name) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, bankCode, bankName, String(accountNumber), accountName || null);

    res.json({ ok: true });
  });

  // Delete a bank account
  app.delete('/api/wallet/bank-accounts/:id', authRequired, (req, res) => {
    db.prepare('DELETE FROM driver_bank_accounts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ ok: true });
  });
}
