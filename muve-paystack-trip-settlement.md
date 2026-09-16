# MUVE — Paystack Trip Payment & Driver Balance Implementation

## Objective

Implement Muve's cashless trip settlement flow using Paystack.

### Required business flow

1. Rider arrives at destination and the trip is completed.
2. Muve displays the final fare.
3. Rider pays the fare by bank transfer to Muve's Paystack-powered payment destination.
4. Paystack confirms the payment.
5. Paystack sends a webhook to Muve.
6. Muve verifies the webhook/payment and matches it to the correct trip.
7. Muve automatically credits the driver's internal Muve wallet/balance.
8. Muve deducts **₦1,000 only from the first completed/paid trip in each driver's 24-hour commission cycle**.
9. Additional completed/paid trips within that driver's active 24-hour cycle have **no ₦1,000 deduction**.
10. Driver can request withdrawal of their available Muve balance to their Nigerian bank account.
11. Muve uses Paystack Transfers to send the withdrawal to the driver's bank account.
12. Every money movement must be recorded in an immutable transaction ledger.

Example:

- First paid trip in 24h: ₦5,000 → Driver ₦4,000, Muve ₦1,000
- Second paid trip in same 24h: ₦5,000 → Driver ₦5,000, Muve ₦0
- Third paid trip in same 24h: ₦3,000 → Driver ₦3,000, Muve ₦0
- After the 24h cycle expires, the next paid trip triggers another ₦1,000 deduction.

---

## Important architecture decision

Do NOT treat the driver's Muve wallet as a Paystack wallet.

The driver should have:

- A Muve driver account.
- An internal Muve wallet/balance represented in the Muve database.
- A verified Nigerian bank account for withdrawals.

The driver does **not** need a separate Paystack account for this architecture.

Paystack is the payment/transfer infrastructure. Muve owns the internal driver ledger.

---

## Before coding

Inspect the existing repository and identify:

- Backend framework and structure.
- Rider trip model.
- Driver model.
- Existing authentication/authorization.
- Existing trip completion flow.
- Existing payment models, if any.
- Existing wallet/balance models, if any.
- Existing environment/configuration system.
- Existing API conventions.
- Existing database schema and migration system.
- Existing frontend rider payment UI.
- Existing driver wallet/withdrawal UI.

Do not unnecessarily rewrite existing architecture.

Follow existing project conventions.

---

# 1. Environment Configuration

Add the required Paystack configuration using environment variables.

Expected variables should include equivalents of:

```env
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_BASE_URL=https://api.paystack.co
PAYSTACK_WEBHOOK_SECRET=
```

Use the repository's existing naming/configuration conventions if they differ.

Never expose `PAYSTACK_SECRET_KEY` to the frontend.

Never hard-code Paystack secret keys.

---

# 2. Payment Architecture

Implement Paystack as the external payment provider.

The backend must be responsible for:

- Creating/identifying payment references.
- Tracking expected trip fares.
- Receiving Paystack webhooks.
- Verifying payment authenticity.
- Matching payments to trips.
- Preventing duplicate processing.
- Updating the Muve ledger.
- Crediting the driver's internal balance.
- Recording Muve's ₦1,000 deduction.
- Initiating driver withdrawals.

The frontend must never directly decide that a payment succeeded.

Only the backend may mark a trip as paid.

---

# 3. Trip Payment State

Add or extend trip payment state with explicit statuses.

Recommended statuses:

```text
UNPAID
AWAITING_PAYMENT
PAID
PAYMENT_FAILED
PAYMENT_EXPIRED
REFUNDED
```

Adapt to existing enums/models where appropriate.

A trip should contain enough information to associate:

```text
tripId
riderId
driverId
fareAmount
currency
paymentReference
paymentStatus
paidAt
```

Use NGN/₦.

Do not use USD.

---

# 4. Payment Reference

Every payable trip must have a unique payment reference.

Example:

```text
MUVE-TRIP-{tripId}-{uniqueSuffix}
```

The reference must be unique and persisted in the database.

Never rely only on rider-entered descriptions to identify a trip.

If Paystack supports metadata/custom fields for the chosen payment flow, include:

```json
{
  "tripId": "...",
  "riderId": "...",
  "driverId": "..."
}
```

Do not trust client-supplied driver IDs or fare amounts during settlement.

The backend must obtain authoritative values from the trip record.

---

# 5. Rider Payment Flow

When the trip reaches destination:

```text
DRIVER/RIDER
    ↓
Trip completed
    ↓
Backend calculates/locks final fare
    ↓
Trip = AWAITING_PAYMENT
    ↓
Rider receives payment instructions
    ↓
Rider transfers exact fare to Muve Paystack payment destination
    ↓
Paystack confirms payment
    ↓
Paystack webhook → Muve backend
    ↓
Muve verifies + settles trip
```

The rider must NOT transfer money directly to the driver's personal bank account.

All trip payments go through Muve's configured Paystack collection flow.

---

# 6. Paystack Webhook

Create a secure Paystack webhook endpoint.

Example:

```text
POST /webhooks/paystack
```

Use the framework's existing routing conventions.

Webhook processing must:

1. Receive the raw request body if required for signature validation.
2. Validate the Paystack signature according to current Paystack documentation.
3. Reject invalid signatures.
4. Parse the event.
5. Process successful payment events.
6. Find the payment/trip using the persisted reference/metadata.
7. Verify the payment with Paystack where appropriate.
8. Confirm amount and currency.
9. Confirm the trip is eligible for settlement.
10. Process the settlement exactly once.
11. Return a successful response to Paystack after safe processing.

Never credit a driver merely because the frontend reports payment success.

---

# 7. Idempotency / Duplicate Webhooks

This is mandatory.

Paystack may retry webhook delivery.

The same payment must never credit the driver twice.

Create a payment/event record or equivalent idempotency mechanism containing a unique provider event/reference.

Settlement must be atomic.

Conceptually:

```text
BEGIN TRANSACTION

if payment/reference already settled:
    return existing result

lock payment/trip settlement record

verify payment

calculate commission

credit driver ledger

record Muve commission

mark trip PAID

mark payment SETTLED

COMMIT
```

If the database supports row-level locking, use it where appropriate.

Never perform:

```text
driver.balance += amount
```

without a corresponding immutable ledger entry.

---

# 8. Driver Internal Wallet

Implement the driver's Muve balance as an internal accounting ledger.

Recommended structure:

### DriverWallet

```text
id
driverId
availableBalance
pendingBalance (if required)
createdAt
updatedAt
```

### WalletTransaction

```text
id
driverId
tripId nullable
withdrawalId nullable
type
amount
currency
status
reference
description
createdAt
```

Recommended transaction types:

```text
TRIP_EARNING
MUVE_COMMISSION
WITHDRAWAL
WITHDRAWAL_REVERSAL
ADJUSTMENT
REFUND
```

Use integer minor units (kobo) internally where appropriate.

Example:

```text
₦5,000 = 500000 kobo
₦1,000 = 100000 kobo
```

Avoid floating-point arithmetic for money.

---

# 9. ₦1,000 / 24-Hour Commission Rule

Implement this as backend business logic.

The rule is:

> Deduct ₦1,000 from the driver's first successfully paid trip within a rolling 24-hour cycle. Do not deduct it again from subsequent successfully paid trips until that cycle expires.

Important:

The cycle is associated with the **driver**, not the rider.

Use a persisted timestamp/state rather than relying on server memory.

Recommended driver fields:

```text
commissionCycleStartedAt nullable
```

or implement an equivalent transaction/commission-cycle table.

Settlement logic:

```text
if commissionCycleStartedAt is null:
    deduct ₦1,000
    commissionCycleStartedAt = now

else if now >= commissionCycleStartedAt + 24 hours:
    deduct ₦1,000
    commissionCycleStartedAt = now

else:
    deduct ₦0
```

The cycle should begin when the first qualifying trip is successfully paid/settled, not merely when the trip starts.

Do not reset the cycle when the driver logs out, restarts the app, or reconnects.

Use UTC timestamps internally.

Display local Nigerian time only at the UI layer.

---

# 10. Settlement Calculation

For each successfully paid trip:

```text
grossFare = trip.finalFare

if driver's commission cycle is inactive/expired:
    muveCommission = min(₦1,000, grossFare)
else:
    muveCommission = ₦0

driverCredit = grossFare - muveCommission
```

Do not allow driver credit to become negative.

If fare is less than ₦1,000, define behavior safely:

```text
muveCommission = min(grossFare, ₦1,000)
driverCredit = grossFare - muveCommission
```

Keep this behavior centralized in one service.

Example:

```text
₦5,000
- ₦1,000 Muve
= ₦4,000 driver

₦5,000
- ₦0 Muve
= ₦5,000 driver
```

---

# 11. Accounting Ledger

Every successful payment must generate auditable records.

Example for a first trip:

```text
Payment received:
+₦5,000

Muve commission:
+₦1,000

Driver earning:
+₦4,000
```

Example subsequent trip:

```text
Payment received:
+₦5,000

Muve commission:
+₦0

Driver earning:
+₦5,000
```

Do not simply mutate a driver's balance without ledger entries.

The driver's displayed balance should be reconcilable from ledger transactions.

---

# 12. Driver Withdrawal

Create a withdrawal flow.

Driver UI:

```text
Available Balance
        ↓
Withdraw
        ↓
Enter/select verified bank account
        ↓
Enter amount
        ↓
Confirm
        ↓
Backend validates
        ↓
Paystack Transfer
        ↓
Transfer status tracked
        ↓
Wallet ledger updated
```

Backend must validate:

- Driver is authenticated.
- Driver is eligible to withdraw.
- Bank account is linked/verified.
- Amount > 0.
- Amount <= available balance.
- No duplicate withdrawal request.
- Minimum withdrawal rules, if the product has one.
- Currency = NGN.

Do not allow the client to directly call Paystack with secret credentials.

---

# 13. Paystack Bank Account Handling

Use Paystack's current Transfer Recipient/Transfer APIs where appropriate.

A driver should have a stored bank recipient/reference associated with their Muve account.

Do not store unnecessary sensitive banking information.

If the current Paystack API requires account verification/resolution, implement that through the backend.

Driver bank account setup should support:

```text
bankCode
accountNumber
accountName
paystackRecipientCode
verificationStatus
```

Adapt to the actual Paystack API and current requirements.

Before production, verify the latest Paystack requirements for:

- Transfers
- Transfer recipients
- Bank account resolution
- Webhooks
- DVA/bank-transfer collections
- Transaction verification
- Account/KYC requirements

Do not invent unsupported Paystack endpoints.

---

# 14. Withdrawal Atomicity

When a driver requests a withdrawal:

Do not permanently deduct the driver's balance before the withdrawal is safely represented in the ledger.

Recommended pattern:

```text
AVAILABLE
   ↓
WITHDRAWAL_PENDING
   ↓
Paystack transfer
   ↓
SUCCESS → WITHDRAWAL_COMPLETED
   ↓
FAILED → WITHDRAWAL_REVERSED / funds returned
```

Reserve the withdrawal amount so it cannot be withdrawn twice.

Use idempotency/reference keys for transfer requests where supported.

---

# 15. Withdrawal Webhooks / Status

Handle Paystack transfer status updates according to the current Paystack API.

At minimum support:

```text
pending
success
failed
reversed
```

Never assume that an API request being accepted means the bank transfer is complete.

Update the Muve withdrawal and wallet ledger based on the verified provider status.

---

# 16. API Endpoints

Adapt these to the existing API architecture.

Suggested endpoints:

### Rider

```text
GET /trips/:tripId/payment
GET /trips/:tripId/payment-status
```

### Driver

```text
GET /driver/wallet
GET /driver/wallet/transactions
GET /driver/bank-account
POST /driver/bank-account
POST /driver/withdrawals
GET /driver/withdrawals
GET /driver/withdrawals/:id
```

### Webhooks

```text
POST /webhooks/paystack
```

Do not create redundant endpoints if equivalent functionality already exists.

---

# 17. Frontend Rider Experience

After trip completion:

Display:

```text
Trip completed

Fare
₦5,000

Payment
Transfer to Muve

Payment reference
MUVE-TRIP-XXXX

Waiting for payment...
```

Once backend confirms payment:

```text
Payment successful
₦5,000
```

Do not mark the trip paid solely because the rider presses a button.

Poll or subscribe to backend payment status as appropriate.

---

# 18. Frontend Driver Experience

Driver wallet screen should show:

```text
Available Balance
₦14,000

Recent Earnings
+₦5,000
+₦4,000
+₦3,000

Withdraw
```

For the first trip in a cycle, show a clear transaction description such as:

```text
Trip earning       +₦4,000
Muve daily fee     -₦1,000
```

For subsequent trips:

```text
Trip earning       +₦5,000
```

The wallet UI must derive values from backend data.

Do not calculate authoritative balances in the frontend.

---

# 19. Admin Visibility

Add/admin-enable visibility into:

- Trip payment status.
- Paystack payment reference.
- Gross trip fare.
- Driver earning.
- ₦1,000 Muve commission.
- Commission cycle start.
- Driver wallet balance.
- Wallet transactions.
- Withdrawal status.
- Paystack transfer reference.
- Failed/reversed payments.
- Failed/reversed withdrawals.

This is necessary for support and reconciliation.

---

# 20. Security Requirements

Mandatory:

- Paystack secret key server-side only.
- Verify webhook signatures.
- Verify transaction amounts server-side.
- Verify currency.
- Never trust rider-supplied fare.
- Never trust driver-supplied earnings.
- Never trust frontend payment-success flags.
- Authenticate driver withdrawal requests.
- Authorize access to wallet records.
- Prevent users from accessing another driver's wallet.
- Prevent duplicate settlement.
- Prevent duplicate withdrawal.
- Validate all monetary inputs.
- Use database transactions for settlement.
- Log provider references for reconciliation.
- Do not log secret keys.
- Avoid logging full sensitive bank details.

---

# 21. Failure Scenarios

Handle these explicitly.

### Rider pays but webhook is delayed

Trip remains:

```text
AWAITING_PAYMENT
```

until verified.

Do not manually credit the driver from the frontend.

### Duplicate webhook

Return safely without another credit.

### Wrong amount

Do not settle automatically.

Flag for investigation/manual reconciliation.

### Payment received for an unknown reference

Record the provider event and flag it for reconciliation.

Do not randomly credit a driver.

### Payment succeeds but database transaction fails

Webhook should be safely retryable and settlement idempotent.

### Driver withdrawal fails

Restore/reserve-release the amount correctly and create a reversal ledger entry where appropriate.

### Paystack is temporarily unavailable

Return a controlled error.

Do not corrupt wallet balances.

---

# 22. Testing

Create automated tests for at least:

### Payment

- Correct payment reference generated.
- Successful payment settles trip.
- Correct driver credited.
- First trip deducts ₦1,000.
- Second trip within 24h has no deduction.
- Third trip within 24h has no deduction.
- Trip after 24h deducts ₦1,000 again.
- ₦1,000 deduction cannot exceed trip fare.
- Duplicate webhook does not duplicate credit.
- Invalid webhook signature rejected.
- Wrong payment amount rejected.
- Wrong currency rejected.
- Unknown payment reference handled safely.

### Wallet

- Ledger matches displayed balance.
- Driver cannot access another driver's wallet.
- Driver cannot withdraw more than available balance.
- Duplicate withdrawal prevented.
- Failed withdrawal reverses/reserves correctly.

### Concurrency

Test two successful payments arriving at nearly the same time for the same driver.

The database must guarantee that **only one qualifying trip receives the ₦1,000 deduction** for a cycle.

This is critical.

---

# 23. Database / Migration Requirements

Create migrations using the existing project's migration system.

Do not manually edit production data.

Ensure:

- Appropriate unique constraints.
- Foreign keys.
- Monetary values stored safely.
- Payment references indexed.
- Provider references indexed/unique where appropriate.
- Wallet transactions indexed by driver/date.
- Withdrawal references unique.
- Commission-cycle state protected against concurrent updates.

---

# 24. Reconciliation

Create a backend/admin service or command that can compare:

```text
Paystack payments
vs
Muve payment records
vs
Trip records
vs
Driver wallet ledger
vs
Withdrawals
```

The goal is to detect discrepancies such as:

```text
Paystack payment exists but trip unpaid
Trip marked paid but no Paystack payment
Driver credited twice
Withdrawal marked completed without transfer success
```

Do not silently repair discrepancies.

Flag them for reconciliation.

---

# 25. Paystack Integration Rule

Use the **current official Paystack API documentation** when implementing the integration.

Do not rely on outdated blog posts or guessed endpoints.

The implementation must accommodate Paystack's current requirements for the selected collection and transfer architecture.

If Paystack's current product/technical requirements prevent the exact proposed flow, stop at the integration boundary and report the specific blocker rather than silently implementing an unsafe substitute.

---

# 26. Definition of Done

The implementation is complete only when:

- Rider can complete a trip.
- Final fare is persisted server-side.
- Rider receives Muve payment instructions.
- Paystack payment can be received.
- Paystack webhook is securely processed.
- Payment is matched to the correct trip.
- Trip becomes PAID only after verified payment.
- Driver balance is automatically credited.
- First paid trip in a 24h cycle deducts ₦1,000.
- Additional trips in that cycle deduct ₦0.
- Next cycle's first paid trip deducts ₦1,000.
- Duplicate webhooks cannot duplicate earnings.
- Driver wallet has an auditable ledger.
- Driver can link a Nigerian bank account.
- Driver can request withdrawal.
- Paystack transfer is initiated server-side.
- Withdrawal status is tracked.
- Failed/reversed withdrawals are handled.
- Rider never pays the driver directly.
- Driver never needs a separate Paystack account for the internal wallet architecture.
- Secret Paystack credentials never reach the frontend.
- Automated tests cover settlement, the 24-hour rule, idempotency, concurrency, and withdrawals.
- Documentation explains environment variables and sandbox/test setup.

---

# Agent Execution Instructions

1. Inspect the repository before modifying anything.
2. Identify existing trip, driver, rider, auth, payment, and database architecture.
3. Reuse existing models/services where sensible.
4. Implement backend settlement first.
5. Implement Paystack integration using current official API documentation.
6. Implement webhook verification and idempotent settlement.
7. Implement the driver wallet ledger.
8. Implement the 24-hour ₦1,000 commission rule with concurrency protection.
9. Implement withdrawals through Paystack Transfers.
10. Implement rider and driver UI.
11. Implement admin visibility if an admin interface exists.
12. Add migrations.
13. Add automated tests.
14. Run lint/type-check/tests.
15. Fix failures.
16. Provide a concise final report containing:
   - Files changed.
   - Database changes.
   - New environment variables.
   - API endpoints added/changed.
   - Paystack configuration required.
   - Tests run and results.
   - Any Paystack account/configuration requirements that cannot be completed in code.

Do not stop after creating database models. Implement the complete end-to-end flow.
