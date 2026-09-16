import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'muve.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('rider','driver')),
  is_sim INTEGER NOT NULL DEFAULT 0,
  rating_sum REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  vehicle_make TEXT, vehicle_model TEXT, vehicle_plate TEXT, vehicle_color TEXT,
  vehicle_tier TEXT DEFAULT 'muvex',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_id INTEGER NOT NULL REFERENCES users(id),
  driver_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'requested',
  tier TEXT NOT NULL,
  pickup_lat REAL NOT NULL, pickup_lng REAL NOT NULL, pickup_addr TEXT,
  drop_lat REAL NOT NULL, drop_lng REAL NOT NULL, drop_addr TEXT,
  distance_m REAL NOT NULL DEFAULT 0,
  duration_s REAL NOT NULL DEFAULT 0,
  fare REAL NOT NULL DEFAULT 0,
  surge REAL NOT NULL DEFAULT 1,
  tip REAL NOT NULL DEFAULT 0,
  rating INTEGER,
  payment_method TEXT DEFAULT 'Cash',
  route_json TEXT,
  cancelled_by TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT, arrived_at TEXT, started_at TEXT, completed_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  brand TEXT NOT NULL,
  last4 TEXT NOT NULL,
  label TEXT,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kyc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  dob TEXT NOT NULL,
  id_type TEXT NOT NULL,
  id_number TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  license_number TEXT,
  vehicle_reg TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Migrations: add columns if they don't exist (for existing databases)
const cols = db.prepare("PRAGMA table_info(kyc)").all().map((c) => c.name);
if (!cols.includes('license_number')) db.exec('ALTER TABLE kyc ADD COLUMN license_number TEXT');
if (!cols.includes('vehicle_reg')) db.exec('ALTER TABLE kyc ADD COLUMN vehicle_reg TEXT');

const rideCols = db.prepare("PRAGMA table_info(rides)").all().map((c) => c.name);
if (!rideCols.includes('proposed_fare')) db.exec('ALTER TABLE rides ADD COLUMN proposed_fare REAL');
if (!rideCols.includes('suggested_fare')) db.exec('ALTER TABLE rides ADD COLUMN suggested_fare REAL');
if (!rideCols.includes('fare_status')) db.exec("ALTER TABLE rides ADD COLUMN fare_status TEXT DEFAULT 'agreed'");

// Paystack dedicated virtual account fields on users + commission cycle timestamp
const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userCols.includes('paystack_customer_code')) db.exec('ALTER TABLE users ADD COLUMN paystack_customer_code TEXT');
if (!userCols.includes('paystack_account_number')) db.exec('ALTER TABLE users ADD COLUMN paystack_account_number TEXT');
if (!userCols.includes('paystack_bank_name')) db.exec('ALTER TABLE users ADD COLUMN paystack_bank_name TEXT');
if (!userCols.includes('commission_cycle_started_at')) db.exec('ALTER TABLE users ADD COLUMN commission_cycle_started_at TEXT');

db.exec(`
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
`);

// Saved places (rider-created quick-pick pins: Home, Work, custom)
db.exec(`
CREATE TABLE IF NOT EXISTS saved_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  addr TEXT,
  type TEXT NOT NULL DEFAULT 'custom',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saved_places_user ON saved_places(user_id);
`);

// Curated Lagos landmarks / estates / POIs for local search (overrides Mapbox gaps)
db.exec(`
CREATE TABLE IF NOT EXISTS landmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  aliases TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  area TEXT,
  category TEXT NOT NULL DEFAULT 'landmark',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_landmarks_name ON landmarks(name);
CREATE INDEX IF NOT EXISTS idx_landmarks_area ON landmarks(area);
`);

// Driver wallets + transaction history
db.exec(`
CREATE TABLE IF NOT EXISTS wallets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  ride_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
`);

// Driver bank accounts for withdrawals (up to 3 per driver)
// Drop old single-account table if it exists (schema changed from user_id PK to id PK)
const oldBankCols = db.prepare("PRAGMA table_info(driver_bank_accounts)").all();
if (oldBankCols.length && !oldBankCols.some((c) => c.name === 'id')) {
  db.exec('DROP TABLE IF EXISTS driver_bank_accounts');
}
db.exec(`
CREATE TABLE IF NOT EXISTS driver_bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_bank_acct_user ON driver_bank_accounts(user_id);');

// Add paystack_recipient_code to bank accounts if missing
const bankCols = db.prepare("PRAGMA table_info(driver_bank_accounts)").all().map((c) => c.name);
if (!bankCols.includes('paystack_recipient_code')) db.exec('ALTER TABLE driver_bank_accounts ADD COLUMN paystack_recipient_code TEXT');

// Withdrawals table — tracks Paystack transfer status
db.exec(`
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  paystack_transfer_code TEXT,
  paystack_recipient_code TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reference TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
`);

// App feedback / ratings from users
db.exec(`
CREATE TABLE IF NOT EXISTS app_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON app_feedback(user_id);
`);

export default db;
