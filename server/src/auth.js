import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'muve-dev-secret';

export function publicUser(u) {
  if (!u) return null;
  const rating = u.rating_count ? Math.round((u.rating_sum / u.rating_count) * 10) / 10 : 5.0;
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, rating,
    trips: u.rating_count,
    vehicle: u.role === 'driver' ? {
      make: u.vehicle_make, model: u.vehicle_model, plate: u.vehicle_plate,
      color: u.vehicle_color, tier: u.vehicle_tier,
    } : null,
  };
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

export function authRequired(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
  if (!req.user) return res.status(401).json({ error: 'User not found' });
  next();
}

export function registerRoutes(app) {
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role, vehicle } = req.body || {};
    if (!name || !email || !password || !['rider', 'driver'].includes(role)) {
      return res.status(400).json({ error: 'name, email, password and role (rider|driver) are required' });
    }
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare(`
      INSERT INTO users (name,email,password_hash,role,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,vehicle_tier)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(name, email, hash, role,
      vehicle?.make || null, vehicle?.model || null, vehicle?.plate || null,
      vehicle?.color || null, vehicle?.tier || 'muvex');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    db.prepare("INSERT INTO payment_methods (user_id, brand, last4, label, is_default) VALUES (?,?,?,?,1)")
      .run(user.id, 'Cash', '----', 'Cash', );
    res.json({ token: signToken(user), user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  });

  app.get('/api/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

  // ---- KYC ----
  app.get('/api/kyc', authRequired, (req, res) => {
    const row = db.prepare('SELECT * FROM kyc WHERE user_id = ?').get(req.user.id);
    if (!row) return res.json({ kyc: null });
    res.json({ kyc: row });
  });

  app.post('/api/kyc', authRequired, (req, res) => {
    const { full_name, phone, dob, id_type, id_number, address, city, state, license_number, vehicle_reg } = req.body || {};
    if (!full_name || !phone || !dob || !id_type || !id_number || !address || !city || !state) {
      return res.status(400).json({ error: 'All KYC fields are required' });
    }
    const validIdTypes = ['nin', 'drivers_license', 'voters_card', 'passport'];
    if (!validIdTypes.includes(id_type)) {
      return res.status(400).json({ error: 'Invalid ID type' });
    }
    // Drivers must provide license and vehicle registration
    if (req.user.role === 'driver' && (!license_number || !vehicle_reg)) {
      return res.status(400).json({ error: 'Driver\'s license number and vehicle registration are required for drivers' });
    }
    const existing = db.prepare('SELECT id FROM kyc WHERE user_id = ?').get(req.user.id);
    if (existing) {
      db.prepare(`UPDATE kyc SET full_name=?, phone=?, dob=?, id_type=?, id_number=?, address=?, city=?, state=?, license_number=?, vehicle_reg=?, status='pending', updated_at=datetime('now') WHERE user_id=?`)
        .run(full_name, phone, dob, id_type, id_number, address, city, state, license_number || null, vehicle_reg || null, req.user.id);
    } else {
      db.prepare(`INSERT INTO kyc (user_id, full_name, phone, dob, id_type, id_number, address, city, state, license_number, vehicle_reg) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(req.user.id, full_name, phone, dob, id_type, id_number, address, city, state, license_number || null, vehicle_reg || null);
    }
    const row = db.prepare('SELECT * FROM kyc WHERE user_id = ?').get(req.user.id);
    res.json({ kyc: row });
  });
}
