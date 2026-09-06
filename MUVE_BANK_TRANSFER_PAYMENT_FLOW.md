# MUVE PAYSTACK PAYMENT FLOW — CODING AGENT SPEC

## Objective

Implement Paystack-powered payments for Muve ride-hailing trips so that:

- Riders NEVER transfer directly to drivers.
- Riders pay the full trip fare through Paystack (card, bank transfer, USSD, or mobile money).
- Muve automatically retains its 10% commission.
- The driver's 90% earnings are recorded in the database (shown on the Earnings page).
- The driver's app confirms payment automatically from Muve's backend via Paystack webhook.
- Do NOT implement rider wallets.
- Do NOT implement cash payments.

## What to Remove

The project currently has mock payment infrastructure that should be removed:

1. **Remove `payment_methods` table** and its CRUD endpoints (`GET/POST/DELETE /api/payments`).
2. **Remove auto-creation of Cash payment method on signup** (in `auth.js`).
3. **Remove `payment_method` dropdown** from RiderHome.jsx — payment is always Paystack.
4. **Remove `paymentMethod` field** from the ride request body and `rideToJson` output.
5. **Remove `payment_method` column** usage from rides (keep the column for migration safety but stop reading/writing it).
6. **Remove mock card display** from Profile.jsx payment methods section.
7. **Remove `cash`/`card` icon usage** related to payment methods.

## Payment Provider

**Paystack** is the required and only payment provider.

- Paystack public key is exposed to the frontend (safe — it's a public key).
- Paystack secret key is server-side only. NEVER expose it to the frontend or commit it to the repository.
- Use Paystack's Popup checkout for payment initiation.
- Use Paystack webhooks for payment confirmation.
- Driver settlement via Paystack Transfer is a future concern — for now, record the 90% earnings in the database. The Earnings page already displays this.

## Required Flow

```text
Rider requests trip
      ↓
Fare calculated
      ↓
Trip is accepted by driver and completed
      ↓
Rider sees "Pay with Paystack" button on the rating/payment screen
      ↓
Backend creates a Paystack transaction (initialize transaction)
  - amount in kobo (fare × 100)
  - reference: muve_trip_{tripId}_{timestamp}
  - channels: [card, bank_transfer, ussd, mobile_money]
  - metadata: { trip_id, rider_id, driver_id, fare, commission, driver_earnings }
      ↓
Paystack returns authorization_url + access_code + reference
      ↓
Frontend opens Paystack Popup checkout
      ↓
Rider completes payment via Paystack (card / bank transfer / USSD / mobile money)
      ↓
Paystack confirms transaction
      ↓
Paystack webhook → Muve backend (charge.success event)
      ↓
Verify transaction via Paystack API (GET /transaction/verify/{reference})
      ↓
Validate amount + reference + currency + transaction status
      ↓
Mark payment PAID
      ↓
Calculate:
  Muve commission = fare × 10%
  Driver earnings = fare × 90%
      ↓
Create payment record in database
      ↓
Notify driver's app: payment:confirmed (WebSocket)
```

## Paystack Integration Details

### Initialization (Backend)

```text
POST https://api.paystack.co/transaction/initialize
Authorization: Bearer PAYSTACK_SECRET_KEY
{
  "email": rider_email,
  "amount": fare_in_kobo,
  "reference": "muve_trip_{tripId}_{timestamp}",
  "channels": ["card", "bank_transfer", "ussd", "mobile_money"],
  "currency": "NGN",
  "metadata": {
    "trip_id": tripId,
    "rider_id": riderId,
    "driver_id": driverId,
    "fare": fare,
    "commission": fare * 0.10,
    "driver_earnings": fare * 0.90
  }
}
```

Returns:

```json
{
  "status": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "...",
    "reference": "..."
  }
}
```

### Verification (Backend — on webhook)

```text
GET https://api.paystack.co/transaction/verify/{reference}
Authorization: Bearer PAYSTACK_SECRET_KEY
```

Validate:

- `data.status === "success"`
- `data.amount === expected_amount_in_kobo`
- `data.currency === "NGN"`
- `data.reference === stored_reference`

### Webhook (Backend)

```text
POST /api/payments/paystack/webhook
```

- Verify webhook signature: compare `x-paystack-signature` header with HMAC SHA-512 of the raw body using `PAYSTACK_SECRET_KEY`.
- Only process `charge.success` events.
- Verify the transaction again via the Paystack API (never trust the webhook payload alone).
- Process idempotently — check if the payment reference is already marked PAID.

## Critical Rules

1. **Never trust rider-provided payment confirmation.**
2. **Never accept screenshots as proof of payment.**
3. **Never mark a trip as paid from the client.**
4. The Paystack webhook + transaction verification is the authoritative payment confirmation.
5. Always verify the transaction via Paystack's API even after receiving a webhook — never trust the webhook payload alone.
6. Validate:
   - transaction/reference
   - expected amount (in kobo)
   - currency (NGN)
   - payment status (success)
   - trip/payment association
7. Make webhook processing **idempotent**. Duplicate webhooks must not create duplicate payment records.
8. Store all monetary values safely using integer minor units (kobo), not floating-point numbers.
9. **Never expose the Paystack secret key to the frontend.** Only the public key is client-side.
10. Verify webhook signatures using the Paystack secret key.

## Payment States

```text
PENDING   — Payment initiated, awaiting Paystack confirmation
PAID      — Payment confirmed by Paystack, commission and earnings recorded
FAILED    — Payment failed or was declined
```

Three states. No more.

## Trip States

The trip can complete normally (driver drops off rider). Payment happens after completion on the rating screen. The trip's `completed` status does NOT depend on payment status — the rider just can't start a new ride until they've paid for the last one.

## Driver UX

Before payment confirmation:

> Payment pending. Waiting for Paystack to confirm.

After webhook confirmation:

> Payment confirmed — ₦X

The driver must NOT need to ask the rider for proof of payment.

## Rider UX

1. Trip completes.
2. Rider sees the rating screen with "Pay with Paystack" button.
3. Clicking opens Paystack Popup checkout.
4. Rider selects payment method (card, bank transfer, USSD, mobile money).
5. Rider completes payment.
6. Rider sees "Payment successful" and can request their next ride.
7. If payment fails, rider can retry.
8. If the rider closes without paying, they cannot request a new ride until they pay for the outstanding trip.

## Backend Requirements

Implement:

- Initialize Paystack transaction (POST `/api/payments/paystack/initialize`)
  - Requires `tripId` in the request body
  - Only the trip's rider can initialize
  - Trip must be in `completed` status
  - Trip must not already have a PAID payment
- Paystack webhook endpoint (POST `/api/payments/paystack/webhook`)
  - Raw body parsing (for signature verification)
  - Signature verification (HMAC SHA-512)
  - Event filtering (`charge.success` only)
  - Idempotency check
  - Transaction verification via Paystack API
- Payment status API (GET `/api/payments/{tripId}/status`)
- 10% Muve commission calculation
- 90% driver earnings calculation
- Real-time driver payment notification via WebSocket (`payment:confirmed` event)
- Block new ride requests if the rider has an unpaid completed trip

## Environment Variables

Server:

```text
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Frontend:

```text
VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Add to `render.yaml`:

```yaml
# On muve-api:
- key: PAYSTACK_SECRET_KEY
  sync: false  # Set in Render dashboard — server only

# On muve (frontend):
- key: VITE_PAYSTACK_PUBLIC_KEY
  sync: false  # Set in Render dashboard
```

## Database

Add a `payments` table:

```sql
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES rides(id),
  rider_id INTEGER NOT NULL REFERENCES users(id),
  driver_id INTEGER NOT NULL REFERENCES users(id),
  paystack_reference TEXT UNIQUE NOT NULL,
  paystack_transaction_id TEXT,
  amount_kobo INTEGER NOT NULL,
  commission_kobo INTEGER NOT NULL,
  driver_earnings_kobo INTEGER NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT DEFAULT 'PENDING',
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_trip ON payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_rider ON payments(rider_id);
```

Unique constraint on `paystack_reference` prevents duplicate payment records.

## Security

- Verify webhook signatures using `PAYSTACK_SECRET_KEY` (HMAC SHA-512).
- Always re-verify transactions via Paystack's API after webhook.
- Never trust frontend payment-status claims.
- Never allow clients to modify `status`, `commission_kobo`, or `driver_earnings_kobo`.
- Handle webhook retries safely (idempotency).

## Acceptance Criteria

The implementation is complete when:

- Mock payment methods (table, endpoints, UI) are removed.
- A rider can pay for a completed trip via Paystack.
- Muve initializes a Paystack transaction and returns the checkout access code.
- Rider completes payment via Paystack (card, bank transfer, USSD, or mobile money).
- Paystack webhook reaches Muve backend.
- Backend verifies the webhook signature AND re-verifies the transaction via Paystack API.
- Backend records the payment with commission and earnings.
- Driver automatically sees `payment:confirmed` via WebSocket.
- Muve's 10% commission is recorded.
- Driver's 90% earnings are recorded (visible on Earnings page).
- Duplicate webhooks cannot duplicate payment records.
- Rider cannot falsely mark a payment as successful.
- Rider with an unpaid trip cannot request a new ride.
- Paystack secret key is never exposed to the frontend.

## Implementation Principle

**The Muve backend + Paystack webhook + Paystack API verification is the single source of truth for payment status.**

Do not implement alternative client-side mechanisms that can override Paystack-confirmed payment status.
