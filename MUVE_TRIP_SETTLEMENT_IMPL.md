# Muve — Trip Settlement Implementation (Current Project State)

## Overview

Replace the current flat **10% commission** model with the **₦1,000 / 24-hour cycle** commission rule, fix the Paystack trip-payment flow, and harden wallet/withdrawal handling.

This document is tailored to what already exists. It does **not** rewrite the stack — it modifies existing files.

---

## What Already Exists (Do Not Rebuild)

| Component | File | Status |
|---|---|---|
| `payments` table (kobo, reference, status) | `server/src/db.js` | Exists. Statuses: `PENDING`, `PAID`, `FAILED` |
| `wallets` table (Naira balance) | `server/src/db.js` | Exists |
| `wallet_transactions` table | `server/src/db.js` | Exists. Types: `credit`, `withdrawal` |
| `driver_bank_accounts` table (max 3) | `server/src/db.js` | Exists |
| Paystack webhook (`charge.success`) | `server/src/payments.js` | Exists. HMAC verified. Has idempotency check. |
| Payment initialize endpoint | `server/src/payments.js` | Exists. Returns `reference` + `amountKobo`. Does NOT call Paystack `/transaction/initialize`. |
| Client-side PaystackPop | `client/src/RiderHome.jsx`, `client/src/Profile.jsx` | Exists. Opens Paystack popup with reference. |
| `creditWallet()` helper | `server/src/wallet.js` | Exists. Updates balance + inserts transaction. |
| Withdrawal via Paystack Transfer | `server/src/wallet.js` | Exists. Creates recipient, initiates transfer, debits wallet. |
| Driver bank account CRUD | `server/src/wallet.js` | Exists. Max 3 accounts. |
| DVA wallet funding | `server/src/wallet.js` | Exists. Paystack dedicated virtual account. |
| Frontend wallet UI | `client/src/Earnings.jsx` | Exists. Balance, fund, withdraw, transactions. |
| Frontend bank account UI | `client/src/Settings.jsx` | Exists. Form + saved accounts list. |

---

## What Needs to Change

### 1. Commission Model: 10% → ₦1,000 / 24h Cycle

**Current:** `commission = fare × 0.10`, `driver = fare × 0.90 + tip`

**New:** `commission = ₦1,000` on first paid trip in a 24h cycle, `₦0` on subsequent trips. Tip still goes 100% to driver.

**Files to change:**
- `server/src/db.js` — Add `commission_cycle_started_at TEXT` column to `users` table (migration).
- `server/src/payments.js` — Replace the 10% calculation in both the webhook handler and the verify endpoint with the ₦1,000 / 24h logic.

**Settlement logic:**
```
grossFareKobo = ride.fare * 100
tipKobo = tip * 100

if commissionCycleStartedAt is null OR now >= commissionCycleStartedAt + 24h:
    muveCommissionKobo = min(100000, grossFareKobo)   // ₦1,000 or fare if less
    commissionCycleStartedAt = now
else:
    muveCommissionKobo = 0

driverEarningsKobo = (grossFareKobo - muveCommissionKobo) + tipKobo
```

**Atomicity:** The commission cycle update, payment status update, wallet credit, and ledger entries must all be in a single `db.transaction()`.

### 2. Richer Wallet Transaction Types

**Current:** `wallet_transactions.type` is `'credit'` or `'withdrawal'`.

**New types:**
- `TRIP_EARNING` — driver's net earnings from a paid trip
- `MUVE_COMMISSION` — the ₦1,000 deduction (negative amount or separate record)
- `WITHDRAWAL` — withdrawal debit (already exists, rename type)
- `WITHDRAWAL_REVERSAL` — failed withdrawal refund
- `WALLET_FUND` — DVA deposit credit (rename from `credit`)
- `ADJUSTMENT` — manual corrections

**Files to change:**
- `server/src/wallet.js` — Update `creditWallet()` to accept a `type` parameter.
- `server/src/payments.js` — Pass `TRIP_EARNING` and `MUVE_COMMISSION` types.
- `client/src/Earnings.jsx` — Display transaction type labels/icons based on new types.

### 3. Fix Paystack Payment Initialize

**Current:** Backend creates a `payments` row and returns `reference` + `amountKobo`. Frontend uses `PaystackPop.setup()` with the reference. PaystackPop creates the transaction client-side.

**Problem:** No metadata is sent to Paystack, so webhook can't cross-check trip/rider/driver IDs.

**Fix:** Add metadata to the PaystackPop call on the frontend:
```js
PaystackPop.setup({
  key: VITE_PAYSTACK_PUBLIC_KEY,
  email: user.email,
  amount: d.amountKobo,
  currency: 'NGN',
  ref: d.reference,
  metadata: {
    custom_fields: [
      { display_name: 'Trip ID', variable_name: 'trip_id', value: tripId },
      { display_name: 'Rider ID', variable_name: 'rider_id', value: user.id },
    ]
  },
  callback: ...
})
```

**Files to change:**
- `client/src/RiderHome.jsx` — Add metadata to `PaystackPop.setup()`.
- `client/src/Profile.jsx` — Same.

### 4. Fix Webhook Bug

**Current bug:** `payments.js` line ~39 references `verifyData` before it's declared on line ~60.

**Fix:** Move the DVA wallet-funding check after the `verifyData` declaration, or restructure so the Paystack verify call happens first.

**Files to change:**
- `server/src/payments.js` — Reorder the webhook handler.

### 5. Add Payment Statuses

**Current:** `PENDING`, `PAID`, `FAILED`

**New:** Keep `PENDING` (rename conceptually to `AWAITING_PAYMENT`), add:
- `PAID` (already exists)
- `FAILED` (already exists)
- `EXPIRED` — payment not received within timeout

No schema change needed — `status` is a TEXT column. Just use the new values.

### 6. Withdrawal Hardening

**Current:** Wallet is debited immediately after `POST /transfer` returns. No transfer status tracking.

**New:**
- Store `paystack_transfer_code` and `transfer_status` in a new `withdrawals` table (or extend `wallet_transactions` with columns).
- After initiating transfer, set status to `PENDING`.
- Add `transfer.success` / `transfer.failed` / `transfer.reversed` handling in the Paystack webhook.
- On `success`: mark withdrawal `COMPLETED`.
- On `failed`/`reversed`: mark withdrawal `REVERSED`, credit wallet back, insert `WITHDRAWAL_REVERSAL` transaction.

**Files to change:**
- `server/src/db.js` — Add `withdrawals` table: `id, user_id, amount, bank_name, account_number, paystack_transfer_code, status, reference, created_at, updated_at`.
- `server/src/wallet.js` — Update withdraw endpoint to create a `withdrawals` row with `PENDING` status instead of immediately debiting. Debit on `success` webhook.
- `server/src/payments.js` — Add `transfer.success`, `transfer.failed`, `transfer.reversed` event handling.

### 7. Store Paystack Recipient Code

**Current:** A new transfer recipient is created on every withdrawal.

**Fix:** Store `paystack_recipient_code` in `driver_bank_accounts` and reuse it.

**Files to change:**
- `server/src/db.js` — Add `paystack_recipient_code TEXT` column to `driver_bank_accounts`.
- `server/src/wallet.js` — On withdrawal, check if recipient code exists. If not, create and store it. If yes, reuse.

### 8. Environment Variables

**Current server `.env`:**
- `SIM_MODE`
- `PAYSTACK_SECRET_KEY`
- `MAPBOX_TOKEN`

**Add:**
- `PAYSTACK_BASE_URL=https://api.paystack.co` (or hardcode as default in code)
- `PAYSTACK_WEBHOOK_SECRET` — if Paystack provides a separate webhook secret (currently the secret key is used for HMAC)

No change needed for `PAYSTACK_PUBLIC_KEY` — it's already in `client/.env` as `VITE_PAYSTACK_PUBLIC_KEY`.

### 9. Frontend Display Updates

**Earnings.jsx:**
- Show `MUVE_COMMISSION` as a separate line item: `Muve daily fee  -₦1,000`
- Show `TRIP_EARNING` as: `Trip earning  +₦4,000`
- Keep `WITHDRAWAL` as: `Withdrawal  -₦5,000`

**RiderHome.jsx / Profile.jsx:**
- After trip completion, show payment reference prominently.
- Show "Waiting for payment..." until webhook confirms.
- On confirmation, show "Payment successful".

### 10. Driver Earnings Endpoint Fix

**Current:** `GET /api/driver/earnings` calculates `fare * 0.90 + tip`.

**Fix:** This should reflect actual settled earnings from `payments.driver_earnings_kobo`, not a hardcoded 90%.

**Files to change:**
- `server/src/rides.js` — Update the earnings query to sum from `payments` where `status = 'PAID'`.

---

## Implementation Order

1. **db.js** — Add `commission_cycle_started_at` to `users`, add `withdrawals` table, add `paystack_recipient_code` to `driver_bank_accounts`.
2. **payments.js** — Fix webhook bug, replace 10% with ₦1,000/24h logic, add atomic transaction, add transfer status handling.
3. **wallet.js** — Add `type` param to `creditWallet()`, update withdrawal to use `withdrawals` table + `PENDING` status, store recipient codes.
4. **rides.js** — Fix earnings endpoint to use actual settled amounts.
5. **RiderHome.jsx + Profile.jsx** — Add Paystack metadata, update payment status display.
6. **Earnings.jsx** — Display new transaction types.
7. **Build + test.**

---

## What We Are NOT Doing

- Not removing the `payment_methods` table (unused, harmless).
- Not adding admin/reconciliation endpoints (out of scope for now).
- Not adding automated tests (manual testing for now).
- Not switching from PaystackPop to server-side `/transaction/initialize` (PaystackPop works and creates valid transactions).
- Not changing the DVA wallet funding flow (it works).
- Not over-engineering. Minimal changes to existing files.

---

## Paystack Test Keys

- Client: `pk_test_...` in `client/.env`
- Server: `sk_test_...` in `server/.env`
- Test cards and DVA work in Paystack sandbox.
- Live keys required for real transfers/withdrawals.

---

## Definition of Done

- [ ] First paid trip in 24h deducts ₦1,000, driver gets `fare - ₦1,000 + tip`
- [ ] Subsequent paid trips in same 24h: driver gets full `fare + tip`
- [ ] After 24h expires, next paid trip deducts ₦1,000 again
- [ ] Webhook handles `charge.success` idempotently and atomically
- [ ] Webhook handles `transfer.success`, `transfer.failed`, `transfer.reversed`
- [ ] Withdrawals go through `PENDING` → `COMPLETED` / `REVERSED`
- [ ] Wallet ledger shows `TRIP_EARNING`, `MUVE_COMMISSION`, `WITHDRAWAL` types
- [ ] Driver earnings endpoint reflects actual settled amounts
- [ ] Frontend shows correct payment status and transaction details
- [ ] Build passes
