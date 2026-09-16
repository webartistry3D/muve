// Saved places REST API: list, create, update, delete for the logged-in user.
import db from './db.js';
import { authRequired } from './auth.js';

function rowToJson(p) {
  if (!p) return null;
  return {
    id: p.id,
    label: p.label,
    lat: p.lat,
    lng: p.lng,
    addr: p.addr,
    type: p.type,
    sortOrder: p.sort_order,
  };
}

export function registerPlaceRoutes(app) {
  // List saved places for the current user
  app.get('/api/places', authRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM saved_places WHERE user_id = ? ORDER BY sort_order ASC, id ASC').all(req.user.id);
    res.json({ places: rows.map(rowToJson) });
  });

  // Create a saved place
  app.post('/api/places', authRequired, (req, res) => {
    const { label, lat, lng, addr, type } = req.body || {};
    if (!label || !lat || !lng) {
      return res.status(400).json({ error: 'label, lat and lng are required' });
    }
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM saved_places WHERE user_id = ?').get(req.user.id).m;
    const info = db.prepare(
      'INSERT INTO saved_places (user_id, label, lat, lng, addr, type, sort_order) VALUES (?,?,?,?,?,?,?)'
    ).run(req.user.id, label, lat, lng, addr || null, type || 'custom', maxOrder + 1);
    const row = db.prepare('SELECT * FROM saved_places WHERE id = ?').get(info.lastInsertRowid);
    res.json({ place: rowToJson(row) });
  });

  // Update a saved place (label, addr, type)
  app.put('/api/places/:id', authRequired, (req, res) => {
    const { label, lat, lng, addr, type } = req.body || {};
    const existing = db.prepare('SELECT * FROM saved_places WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Place not found' });
    db.prepare('UPDATE saved_places SET label=?, lat=?, lng=?, addr=?, type=? WHERE id=?')
      .run(label ?? existing.label, lat ?? existing.lat, lng ?? existing.lng, addr ?? existing.addr, type ?? existing.type, req.params.id);
    const row = db.prepare('SELECT * FROM saved_places WHERE id = ?').get(req.params.id);
    res.json({ place: rowToJson(row) });
  });

  // Delete a saved place
  app.delete('/api/places/:id', authRequired, (req, res) => {
    const existing = db.prepare('SELECT id FROM saved_places WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Place not found' });
    db.prepare('DELETE FROM saved_places WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });
}
