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

export default db;
