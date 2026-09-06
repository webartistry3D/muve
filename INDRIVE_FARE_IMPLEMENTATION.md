# inDrive-Style Fare Implementation — Muve

> Source: `bolt-indrive-research.md`
> Goal: Replace placeholder fare constants with realistic Lagos fares modeled on inDrive's structure, and align surge behavior to inDrive's "drivers act as the surge" model.
> Rule: Keep it simple. No new tables, no new endpoints. Just fix the numbers and the surge logic.

---

## Current State (what's wrong)

`server/src/fares.js` has placeholder values:

| Tier   | base | perKm | perMin | minFare |
|--------|------|-------|--------|---------|
| MuveX  | 200  | 120   | 15     | 500     |
| MuveXL | 350  | 180   | 22     | 800     |
| Black  | 600  | 280   | 35     | 1500    |

These produce fares that are too low for Lagos and don't match inDrive's structure.

Surge is automated via `computeSurge()` — a formula that multiplies the fare. inDrive does NOT auto-surge. Drivers bargain up instead.

---

## Target State (inDrive model)

### 1. Fare Formula (same shape, realistic numbers)

`fare = base + (distanceKm × perKm) + (durationMin × perMin)`

Clamp to `minFare`. No surge multiplier applied automatically.

Based on inDrive's breakdown for a 24.2 km / 44 min trip landing around ₦4,500–₦5,500 for the standard tier:

| Tier       | base | perKm | perMin | minFare | Example (24.2km, 44min) |
|------------|------|-------|--------|---------|-------------------------|
| MuveX      | 350  | 110   | 20     | 1000    | 350 + 2,662 + 880 = ₦3,892 |
| MuveXL     | 500  | 160   | 28     | 1500    | 500 + 3,872 + 1,232 = ₦5,604 |
| Muve Black | 800  | 250   | 40     | 2000    | 800 + 6,050 + 1,760 = ₦8,610 |

These match the research: MuveX baseline ~₦3,890 on a clear day, XL and Black scale up proportionally.

### 2. Surge — Remove auto-multiplier

inDrive's model: **no automated surge**. Drivers are the surge.

Changes:
- `computeSurge()` → always returns `1` (keep the function so we don't break imports).
- Remove surge from the fare calculation in `fareFor()` — it already defaults to `1`, so just stop passing a surge value.
- The `surge` field stays in the DB and ride object for display ("1.0x") but never changes the fare.
- Fare negotiation (already implemented) handles peak pricing: rider proposes lower, driver counters higher. That IS the surge.

### 3. Fare Negotiation (already exists — verify it works)

The existing flow in `server/src/rides.js`:
- Rider requests with `proposedFare` (optional) → `fare_status = 'proposed'`
- Driver counters → `fare_status = 'countered'`
- Rider accepts/declines counter

This already matches inDrive's bidding model. No changes needed to the negotiation logic.

### 4. Min fare enforcement on rider proposal

Add a guard: rider cannot propose below `minFare` for the selected tier.
This prevents absurd lowballs while still allowing bargaining.

---

## Execution Checklist

### Step 1: Update tier constants in `server/src/fares.js`

Replace the `TIERS` object with the new numbers above.

### Step 2: Neutralize surge

In `server/src/fares.js`:
- Change `computeSurge()` to return `1` always.
- Keep the export so imports don't break.

### Step 3: Add min-fare guard on rider proposal

In `server/src/rides.js`, in the `POST /api/rides` handler:
- After validating `tier`, look up `TIERS[tier].minFare`.
- If `proposedFare` is provided and is less than `minFare`, return `400` with a helpful message.

### Step 4: Verify fare display on frontend

The frontend already shows `fmtMoney(t.fare)` in the tier dropdown and request button.
No frontend changes needed — the new numbers flow through automatically.

### Step 5: Test

- Request a ride with a known distance (e.g., Festac → Ikoyi ~24km).
- Confirm MuveX fare is around ₦3,800–₦4,200.
- Confirm rider can propose a fare ≥ ₦1,000 (MuveX min).
- Confirm rider cannot propose below ₦1,000.
- Confirm driver can counter with a higher fare.
- Confirm no surge multiplier is applied.

---

## What NOT to do

- Do not add new database tables.
- Do not add new API endpoints.
- Do not add time-of-day surge zones.
- Do not add traffic-based dynamic pricing.
- Do not remove the surge column from the DB (leave it for future use).
- Do not change the commission structure (still 10% on fare, tip 100% to driver).
