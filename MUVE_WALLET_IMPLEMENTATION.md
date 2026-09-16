# Muve Wallet — Fund & Withdraw via Paystack

> Implementation spec for driver wallet funding and bank withdrawal using Paystack as the payment gateway.

## Overview

Drivers can:
1. **Fund** their Muve wallet (transfer money to a Paystack dedicated virtual account)
2. **Withdraw** from their Muve wallet (transfer to a Nigerian bank account via Paystack Transfer API)

All amounts in **NGN (Naira)**. Minimum fund: ₦500. Minimum withdraw: ₦1,000.

---

## Current State

The wallet module already exists with:
- `wallets` table (user_id, balance)
- `wallet_transactions` table (type, amount, description, ride_id)
- Auto-credit on trip payment (driver earns 90% fare + 100% tip)
- `GET /api/wallet` — balance + transactions
- `POST /api/wallet/withdraw` — internal balance deduction (no Paystack transfer yet)

**What's missing:**
- Fund flow (Paystack dedicated virtual account creation + webhook for incoming transfer)
- Withdraw endpoint wired to Paystack Transfer API (send money to driver's bank)
- Bank account resolution (verify account number + bank code via Paystack)
- Frontend "Fund wallet" button showing virtual account details
- Frontend bank account setup for withdrawals

---

## Environment Variables

Already configured:

```
# server/.env
PAYSTACK_SECRET_KEY=sk_test_xxx

# client/.env
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxx
```

No new env vars needed.

---

## How "Pay with Transfer" Works

Paystack provides **Dedicated Virtual Accounts** (DVAs). Each driver gets a unique Nigerian bank account number tied to their Paystack customer record. When the driver transfers money to that account from their own bank app, Paystack detects the payment and sends a webhook to Muve. Muve then credits the driver's wallet.

This is **not** a card payment — the driver uses their bank app to do a normal bank transfer to the virtual account.

### Paystack Flow

```
Driver requests to fund wallet
  → Muve creates a Paystack Customer (if not exists)
  → Muve creates a Dedicated Virtual Account for that customer
  → Driver sees account number + bank name on screen
  → Driver opens their bank app and transfers to that account
  → Paystack receives the transfer
  → Paystack sends webhook (charge.success) to Muve
  → Muve credits the driver's wallet
```

---

## Backend Changes

### 1. `server/src/db.js` — Add Paystack customer + virtual account columns

```sql
ALTER TABLE users ADD COLUMN paystack_customer_code TEXT;
ALTER TABLE users ADD COLUMN paystack_account_number TEXT;
ALTER TABLE users ADD COLUMN paystack_bank_name TEXT;
```

These store the driver's Paystack customer code and assigned virtual account so we don't create duplicates.

### 2. `server/src/wallet.js` — Add fund + withdraw-via-Paystack

Add imports:

```js
import db from './db.js';
import { authRequired } from './auth.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';
```

#### `POST /api/wallet/fund`

Creates (or retrieves) a Paystack dedicated virtual account for the driver. Returns the account details so the driver can transfer.

```js
app.post('/api/wallet/fund', authRequired, async (req, res) => {
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
          phone: '',
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
```

#### `GET /api/wallet/account`

Returns the driver's existing virtual account (if already created) without creating a new one:

```js
app.get('/api/wallet/account', authRequired, (req, res) => {
  const user = db.prepare('SELECT paystack_account_number, paystack_bank_name FROM users WHERE id = ?').get(req.user.id);
  if (!user?.paystack_account_number) return res.json({ accountNumber: null, bankName: null });
  res.json({ accountNumber: user.paystack_account_number, bankName: user.paystack_bank_name });
});
```

### 3. `server/src/payments.js` — Handle incoming transfer webhook

The existing Paystack webhook handler already checks for `charge.success`. Add a branch for wallet funding (transfers to virtual accounts come through as `charge.success` with a `reason` or `metadata` indicating wallet funding):

```js
// Inside the existing webhook handler, after payment verification:
if (verifyData.data.channel === 'dedicated_account' || verifyData.data.metadata?.wallet_fund) {
  // This is a wallet funding transfer, not a trip payment
  const userId = verifyData.data.metadata?.user_id;
  const amount = verifyData.data.amount / 100;
  if (userId && amount > 0) {
    creditWallet(userId, amount, 'Wallet funding via bank transfer');
    emitToUser(userId, 'wallet:funded', { amount, balance: /* fetch balance */ });
  }
  return res.status(200).send('Wallet funded');
}
```

**Important:** When creating the dedicated account, attach metadata so the webhook can identify wallet funding:

```js
// In the dedicated_account creation call, add:
body: JSON.stringify({
  customer: customerCode,
  metadata: { wallet_fund: true, user_id: req.user.id },
}),
```

Alternatively, look up the customer code → user mapping when the webhook arrives.

### 4. `POST /api/wallet/withdraw` — Transfer to bank via Paystack

```js
app.post('/api/wallet/withdraw', authRequired, async (req, res) => {
  const { amount, accountNumber, bankCode } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt < 1000) return res.status(400).json({ error: 'Minimum withdrawal is ₦1,000' });
  if (!accountNumber || !bankCode) return res.status(400).json({ error: 'Bank account required' });

  ensureWallet(req.user.id);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.user.id);
  if (wallet.balance < amt) return res.status(400).json({ error: 'Insufficient balance' });

  try {
    // Step 1: Create transfer recipient
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
    if (!recipientData.status) return res.status(400).json({ error: 'Could not resolve bank account' });

    // Step 2: Initiate transfer
    const transferResp = await fetch(`${PAYSTACK_BASE}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amt * 100),
        recipient: recipientData.data.recipient_code,
        reason: 'Muve wallet withdrawal',
      }),
    });
    const transferData = await transferResp.json();
    if (!transferData.status) return res.status(400).json({ error: 'Transfer failed' });

    // Step 3: Deduct wallet balance + log transaction
    const tx = db.transaction(() => {
      db.prepare('UPDATE wallets SET balance = balance - ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(amt, req.user.id);
      db.prepare('INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)').run(req.user.id, 'withdrawal', -amt, `Withdrawal to ${accountNumber}`);
    });
    tx();

    const balance = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(req.user.id).balance;
    res.json({ ok: true, balance, transferCode: transferData.data.transfer_code });
  } catch (err) {
    console.error('Wallet withdraw error:', err);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});
```

### 5. `GET /api/wallet/banks`

Returns list of supported Nigerian banks (for withdrawal bank selection):

```js
app.get('/api/wallet/banks', authRequired, async (_req, res) => {
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
```

---

## Frontend Changes

### 1. `client/src/api.js` — Add wallet API functions

```js
export async function fundWallet() {
  return api('/api/wallet/fund', { method: 'POST' });
}
export async function getWalletAccount() {
  return api('/api/wallet/account');
}
export async function withdrawWallet(amount, accountNumber, bankCode) {
  return api('/api/wallet/withdraw', { method: 'POST', body: { amount, accountNumber, bankCode } });
}
export async function listBanks() {
  return api('/api/wallet/banks');
}
```

### 2. `client/src/Earnings.jsx` — Add Fund + Withdraw UI

#### Fund wallet modal (shows virtual account details)

Unlike card payments, funding shows the driver's dedicated virtual account. The driver transfers from their bank app to this account. The wallet auto-credits when Paystack confirms the transfer.

```jsx
{showFund && (
  <div className="modal-overlay" onClick={() => setShowFund(false)}>
    <div className="save-modal" onClick={(e) => e.stopPropagation()}>
      <div className="save-modal-title">Fund wallet</div>
      {loadingAccount ? (
        <div className="row" style={{ justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
      ) : fundAccount?.accountNumber ? (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>
            Transfer money to the account below. Your wallet will be credited automatically.
          </p>
          <div className="fund-account-box">
            <div className="muted">Bank</div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{fundAccount.bankName}</div>
            <div className="muted">Account number</div>
            <div className="row" style={{ alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 20 }} className="num">{fundAccount.accountNumber}</span>
              <button className="btn btn-light" onClick={() => { navigator.clipboard.writeText(fundAccount.accountNumber); setToast('Account number copied'); setTimeout(() => setToast(''), 2000); }}>Copy</button>
            </div>
          </div>
        </>
      ) : (
        <p className="muted">Could not generate account. Please try again.</p>
      )}
      <div className="save-modal-actions">
        <button className="btn btn-light" onClick={() => setShowFund(false)}>Close</button>
        <button className="btn btn-dark" onClick={generateAccount} disabled={loadingAccount}>Refresh</button>
      </div>
    </div>
  </div>
)}
```

#### Fund handler

```js
const [showFund, setShowFund] = useState(false);
const [fundAccount, setFundAccount] = useState(null);
const [loadingAccount, setLoadingAccount] = useState(false);

const generateAccount = async () => {
  setLoadingAccount(true);
  try {
    const d = await fundWallet();
    setFundAccount(d);
  } catch (e) {
    setToast(e.message || 'Could not generate account');
  } finally {
    setLoadingAccount(false);
  }
};

const openFund = () => {
  setShowFund(true);
  if (!fundAccount) generateAccount();
};
```

#### Withdraw modal (with bank selection)

```jsx
{showWithdraw && wallet && (
  <div className="modal-overlay" onClick={() => setShowWithdraw(false)}>
    <div className="save-modal" onClick={(e) => e.stopPropagation()}>
      <div className="save-modal-title">Withdraw to bank</div>
      <div className="muted" style={{ marginBottom: 12 }}>Available: <span className="num" style={{ fontWeight: 700 }}>{fmtMoney(wallet.balance)}</span></div>
      <select className="save-modal-input" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
        <option value="">Select bank</option>
        {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
      </select>
      <input
        className="save-modal-input num"
        type="text"
        inputMode="numeric"
        placeholder="Account number (10 digits)"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d]/g, ''))}
        maxLength={10}
      />
      <input
        className="save-modal-input num"
        type="text"
        inputMode="numeric"
        placeholder="Amount (min ₦1,000)"
        value={withdrawAmt}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, '');
          setWithdrawAmt(raw ? Number(raw).toLocaleString('en-NG') : '');
        }}
      />
      {withdrawErr && <div className="muted" style={{ color: 'var(--red)', marginBottom: 10 }}>{withdrawErr}</div>}
      <div className="save-modal-actions">
        <button className="btn btn-light" onClick={() => setShowWithdraw(false)}>Cancel</button>
        <button className="btn btn-dark" onClick={doWithdraw} disabled={withdrawing}>{withdrawing ? 'Processing…' : 'Withdraw'}</button>
      </div>
    </div>
  </div>
)}
```

#### Withdraw handler

```js
const doWithdraw = async () => {
  const amt = Number(withdrawAmt.replace(/,/g, ''));
  if (!amt || amt < 1000) { setWithdrawErr('Minimum withdrawal is ₦1,000'); return; }
  if (!bankCode) { setWithdrawErr('Select your bank'); return; }
  if (accountNumber.length !== 10) { setWithdrawErr('Enter a valid 10-digit account number'); return; }
  setWithdrawing(true);
  setWithdrawErr('');
  try {
    const res = await withdrawWallet(amt, accountNumber, bankCode);
    setWallet((w) => ({ ...w, balance: res.balance }));
    setToast(`Withdrawal of ${fmtMoney(amt)} initiated`);
    setTimeout(() => setToast(''), 3500);
    setShowWithdraw(false);
    setWithdrawAmt('');
    setAccountNumber('');
    setBankCode('');
    loadWallet();
  } catch (e) {
    setWithdrawErr(e.message || 'Withdrawal failed');
  } finally {
    setWithdrawing(false);
  }
};
```

### 3. Wallet card buttons

```jsx
<div className="wallet-card">
  <div className="wallet-label">Wallet balance</div>
  <div className="wallet-balance num">{fmtMoney(wallet.balance)}</div>
  <div className="row" style={{ gap: 8, marginTop: 8 }}>
    <button className="btn btn-light wallet-btn" onClick={openFund}>
      <span className="row" style={{ gap: 6 }}><Icon name="plus" size={16} /> Fund</span>
    </button>
    <button className="btn btn-light wallet-btn" onClick={() => { loadBanks(); setShowWithdraw(true); }}>
      <span className="row" style={{ gap: 6 }}><Icon name="cash" size={16} /> Withdraw</span>
    </button>
  </div>
</div>
```

### 4. Socket listener for auto-credit

When the Paystack webhook confirms a transfer, the backend emits `wallet:funded`. Add a listener in Earnings.jsx:

```js
useEffect(() => {
  const socket = getSocket();
  if (!socket) return;
  const onFunded = ({ amount, balance }) => {
    setWallet((w) => ({ ...w, balance }));
    setToast(`Wallet funded with ${fmtMoney(amount)}`);
    setTimeout(() => setToast(''), 3500);
    loadWallet();
  };
  socket.on('wallet:funded', onFunded);
  return () => socket.off('wallet:funded', onFunded);
}, []);
```

### 5. CSS for fund account box

```css
.fund-account-box { background: var(--surface-2); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.wallet-btn { flex: 1; justify-content: center; }
```

---

## State additions for Earnings.jsx

```js
const [showFund, setShowFund] = useState(false);
const [fundAccount, setFundAccount] = useState(null);
const [loadingAccount, setLoadingAccount] = useState(false);
const [banks, setBanks] = useState([]);
const [bankCode, setBankCode] = useState('');
const [accountNumber, setAccountNumber] = useState('');
```

---

## API Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/wallet` | Yes | Balance + transaction history |
| POST | `/api/wallet/fund` | Yes | Create/retrieve dedicated virtual account |
| GET | `/api/wallet/account` | Yes | Get existing virtual account (if any) |
| POST | `/api/wallet/withdraw` | Yes | Transfer to bank via Paystack |
| GET | `/api/wallet/banks` | Yes | List Nigerian banks |

---

## Flow Diagrams

### Fund Wallet (Bank Transfer)

```
Driver clicks "Fund"
  → POST /api/wallet/fund
  → Backend creates Paystack Customer (if first time)
  → Backend creates Dedicated Virtual Account (if first time)
  → Returns account number + bank name
  → Driver sees account details on screen
  → Driver opens their bank app, transfers to the virtual account
  → Paystack receives the transfer
  → Paystack sends charge.success webhook to Muve
  → Muve credits driver's wallet via creditWallet()
  → Muve emits wallet:funded socket event
  → Driver's Earnings page auto-updates with new balance + toast
```

### Withdraw

```
Driver clicks "Withdraw" → selects bank + enters account number + amount
  → POST /api/wallet/withdraw
  → Backend creates Paystack transfer recipient
  → Backend initiates Paystack transfer
  → Wallet balance deducted + transaction logged
  → UI updates balance
  → Paystack sends money to driver's bank account
```

---

## Paystack API References

- [Create Customer](https://paystack.com/docs/api/customer/create-customer/) — `POST /customer`
- [Create Dedicated Account](https://paystack.com/docs/api/dedicated-account/create/) — `POST /dedicated_account`
- [Create Transfer Recipient](https://paystack.com/docs/api/transfer-recipient/create/) — `POST /transferrecipient`
- [Initiate Transfer](https://paystack.com/docs/api/transfer/initiate/) — `POST /transfer`
- [List Banks](https://paystack.com/docs/api/bank/list-banks/) — `GET /bank`

---

## Notes

- Paystack test keys don't support real dedicated virtual accounts or transfers. Use live keys for production.
- The dedicated virtual account is permanent — once created, the driver can reuse it for future funding without generating a new one.
- Transfer failures (wrong account, bank downtime) will still deduct the wallet. A webhook listener for `transfer.failed` events should reverse the deduction. This can be added later.
- The existing `creditWallet()` function is reused for funding credits.
- No new database tables needed — `users` table gets 3 new columns for Paystack customer code + virtual account details.
