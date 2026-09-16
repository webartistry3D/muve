// Curated Lagos landmarks REST API: public search + admin CRUD.
// Search is open to any authenticated user; create/update/delete require a
// query param ?admin=1 with the master key (MUVE_ADMIN_KEY env) for now.
// In a real deployment this would be behind an admin role.
import db from './db.js';
import { authRequired } from './auth.js';

const ADMIN_KEY = process.env.MUVE_ADMIN_KEY || 'muve-admin-dev';

function isAdmin(req) {
  return req.query.admin === ADMIN_KEY;
}

function rowToJson(l) {
  if (!l) return null;
  return {
    id: l.id,
    name: l.name,
    aliases: l.aliases ? l.aliases.split('|') : [],
    lat: l.lat,
    lng: l.lng,
    area: l.area,
    category: l.category,
  };
}

// FTS-style search: name or aliases LIKE %q%, scoped to Lagos bounds.
// Returns up to `limit` results ordered by relevance (name match first).
export function searchLandmarks(q, limit = 10) {
  const term = `%${q.trim().toLowerCase()}%`;
  const rows = db.prepare(`
    SELECT * FROM landmarks
    WHERE LOWER(name) LIKE ? OR LOWER(aliases) LIKE ? OR LOWER(area) LIKE ?
    ORDER BY CASE WHEN LOWER(name) LIKE ? THEN 0 ELSE 1 END, name ASC
    LIMIT ?
  `).all(term, term, term, term, limit);
  return rows.map(rowToJson);
}

export function registerLandmarkRoutes(app) {
  // Public search (auth required so the endpoint isn't open to the world)
  app.get('/api/landmarks/search', authRequired, (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });
    res.json({ results: searchLandmarks(q, 1) });
  });

  // List all (auth required)
  app.get('/api/landmarks', authRequired, (_req, res) => {
    const rows = db.prepare('SELECT * FROM landmarks ORDER BY name ASC').all();
    res.json({ landmarks: rows.map(rowToJson) });
  });

  // Create (admin only)
  app.post('/api/landmarks', authRequired, (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin key required' });
    const { name, aliases, lat, lng, area, category } = req.body || {};
    if (!name || !lat || !lng) return res.status(400).json({ error: 'name, lat, lng required' });
    const info = db.prepare(
      'INSERT INTO landmarks (name, aliases, lat, lng, area, category) VALUES (?,?,?,?,?,?)'
    ).run(name, aliases || null, lat, lng, area || null, category || 'landmark');
    const row = db.prepare('SELECT * FROM landmarks WHERE id = ?').get(info.lastInsertRowid);
    res.json({ landmark: rowToJson(row) });
  });

  // Update (admin only)
  app.put('/api/landmarks/:id', authRequired, (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin key required' });
    const existing = db.prepare('SELECT * FROM landmarks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Landmark not found' });
    const { name, aliases, lat, lng, area, category } = req.body || {};
    db.prepare('UPDATE landmarks SET name=?, aliases=?, lat=?, lng=?, area=?, category=? WHERE id=?')
      .run(name ?? existing.name, aliases ?? existing.aliases, lat ?? existing.lat, lng ?? existing.lng, area ?? existing.area, category ?? existing.category, req.params.id);
    const row = db.prepare('SELECT * FROM landmarks WHERE id = ?').get(req.params.id);
    res.json({ landmark: rowToJson(row) });
  });

  // Delete (admin only)
  app.delete('/api/landmarks/:id', authRequired, (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin key required' });
    const existing = db.prepare('SELECT id FROM landmarks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Landmark not found' });
    db.prepare('DELETE FROM landmarks WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });
}

// Seed the landmarks table with a curated Lagos dataset if it's empty.
// Called once at server boot.
export function seedLandmarksIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM landmarks').get().n;
  if (count > 0) return;
  const insert = db.prepare(
    'INSERT INTO landmarks (name, aliases, lat, lng, area, category) VALUES (?,?,?,?,?,?)'
  );
  const seeds = [
    // --- Estates / Neighborhoods ---
    ['Festac Town', 'festival town|festac', 6.4470, 3.3430, 'Amuwo Odofin', 'estate'],
    ['Lekki Phase 1', 'lekki phase one|lekki 1', 6.4350, 3.4750, 'Lekki', 'estate'],
    ['Lekki Phase 2', 'lekki phase two|lekki 2', 6.4050, 3.5050, 'Lekki', 'estate'],
    ['Victoria Island', 'v.i|vi', 6.4281, 3.4219, 'Eti-Osa', 'estate'],
    ['Ikoyi', 'old ikoyi', 6.4475, 3.4370, 'Eti-Osa', 'estate'],
    ['Ikeja GRA', 'ikeja government reserved area|gra ikeja', 6.5830, 3.3490, 'Ikeja', 'estate'],
    ['Magodo', 'magodo gra|magodo 1|magodo 2', 6.6410, 3.3770, 'Kosofe', 'estate'],
    ['Maryland', 'maryland estate', 6.5660, 3.3490, 'Ikeja', 'estate'],
    ['Gbagada', 'gbagada estate|gbagada phase 1|gbagada phase 2', 6.5330, 3.3890, 'Kosofe', 'estate'],
    ['Yaba', 'yaba lagos', 6.5080, 3.3690, 'Lagos Mainland', 'estate'],
    ['Surulere', 'surulere lagos', 6.4930, 3.3590, 'Surulere', 'estate'],
    ['Apapa', 'apapa lagos', 6.4480, 3.3630, 'Apapa', 'estate'],
    ['Epe', 'epe lagos', 6.6050, 3.9820, 'Epe', 'estate'],
    ['Ikorodu', 'ikorodu lagos', 6.6190, 3.5080, 'Ikorodu', 'estate'],
    ['Badagry', 'badagry lagos', 6.4330, 2.9330, 'Badagry', 'estate'],
    ['Agege', 'agege lagos', 6.6210, 3.3240, 'Agege', 'estate'],
    ['Ojodu', 'ojodu berger|ojodu estate', 6.6290, 3.3580, 'Ikeja', 'estate'],
    ['Omole Phase 1', 'omole|omole estate|omole 1', 6.6240, 3.3670, 'Ikeja', 'estate'],
    ['Omole Phase 2', 'omole 2|omole phase two', 6.6300, 3.3720, 'Ikeja', 'estate'],
    ['Allen Avenue', 'allen ikeja', 6.5900, 3.3520, 'Ikeja', 'estate'],
    ['Computer Village', 'computer village ikeja|ikeja computer village', 6.5770, 3.3390, 'Ikeja', 'landmark'],
    ['Alausa', 'alausa secretariat|lagos state secretariat', 6.6030, 3.3520, 'Ikeja', 'landmark'],

    // --- Malls / Shopping ---
    ['Shoprite Ikeja', 'shoprite ikeja city mall|ikeja city mall', 6.6020, 3.3500, 'Ikeja', 'mall'],
    ['Palms Shopping Mall', 'the palms|palms mall lekki|palms shopping mall', 6.4300, 3.4400, 'Lekki', 'mall'],
    ['Maryland Mall', 'maryland mall lagos', 6.5680, 3.3510, 'Maryland', 'mall'],
    ['Jabi Lake Mall', 'jabi lake mall abuja', 9.0765, 7.4720, 'Abuja', 'mall'],
    ['Circle Mall', 'circle mall lekki|circle mall jakande', 6.4470, 3.5020, 'Lekki', 'mall'],
    ['E-Centre', 'e centre festac|e-centre', 6.4490, 3.3460, 'Festac', 'mall'],
    ['Novare Mall', 'novare mall sangotedo|novare lekki', 6.4180, 3.5350, 'Sangotedo', 'mall'],

    // --- Hotels ---
    ['Eko Hotel & Suites', 'eko hotel|eko hotel victoria island', 6.4270, 3.4140, 'Victoria Island', 'hotel'],
    ['Radisson Blu', 'radisson blu anchorage|radisson blu lagos', 6.4520, 3.4270, 'Ikoyi', 'hotel'],
    ['Federal Palace Hotel', 'federal palace hotel lagos|federal palace', 6.4320, 3.4150, 'Victoria Island', 'hotel'],
    ['Intercontinental Lagos', 'intercontinental hotel lagos', 6.4330, 3.4290, 'Victoria Island', 'hotel'],
    ['The George', 'the george hotel ikoyi', 6.4490, 3.4340, 'Ikoyi', 'hotel'],
    ['Wheatbaker Hotel', 'the wheatbaker|wheatbaker ikoyi', 6.4480, 3.4310, 'Ikoyi', 'hotel'],
    ['Four Points by Sheraton', 'four points lagos|four points sheraton', 6.4490, 3.4270, 'Ikoyi', 'hotel'],

    // --- Transport hubs ---
    ['Murtala Muhammed Airport', 'mmia|lagos airport|murtala muhammed international airport', 6.5770, 3.3210, 'Ikeja', 'transport'],
    ['Murtala Muhammed Airport Terminal 2', 'mmia terminal 2|airport terminal 2', 6.5800, 3.3260, 'Ikeja', 'transport'],
    ['Iddo Railway Station', 'iddo train station|lagos railway station', 6.4890, 3.3760, 'Lagos Mainland', 'transport'],
    ['Lagos Terminus', 'lagos terminus train station', 6.4770, 3.3890, 'Lagos Island', 'transport'],
    ['TBS Bus Stop', 'tbs|tincan bus stop|tbs lagos', 6.4430, 3.4070, 'Lagos Island', 'transport'],
    ['Oshodi Transport Hub', 'oshodi bus terminal|oshodi interchange', 6.5500, 3.3390, 'Oshodi', 'transport'],
    ['Ojuelegba', 'ojuelegba bus stop', 6.5020, 3.3670, 'Lagos Mainland', 'transport'],
    ['CMS Bus Stop', 'cms lagos|cms bus stop', 6.4470, 3.3890, 'Lagos Island', 'transport'],
    ['Lagos Island', 'lagos island|idumota|broad street lagos', 6.4530, 3.3900, 'Lagos Island', 'landmark'],

    // --- Markets ---
    ['Balogun Market', 'balogun lagos', 6.4480, 3.3880, 'Lagos Island', 'market'],
    ['Mile 12 Market', 'mile 12 food market', 6.5830, 3.4060, 'Kosofe', 'market'],
    ['Oyingbo Market', 'oyingbo lagos', 6.4890, 3.3790, 'Lagos Mainland', 'market'],
    ['Mushin Market', 'mushin lagos', 6.5360, 3.3510, 'Mushin', 'market'],
    ['Alaba International Market', 'alaba market|alaba electronics market', 6.4670, 3.3190, 'Ojo', 'market'],
    ['Trade Fair Market', 'international trade fair complex lagos', 6.4520, 3.3110, 'Amuwo Odofin', 'market'],
    ['Mile 2 Market', 'mile 2 lagos', 6.4630, 3.3390, 'Amuwo Odofin', 'market'],
    ['Oshodi Market', 'oshodi lagos market', 6.5490, 3.3430, 'Oshodi', 'market'],
    ['Yaba Market', 'yaba tech market', 6.5060, 3.3710, 'Yaba', 'market'],

    // --- Hospitals ---
    ['Lagos University Teaching Hospital', 'luth|luth idiaraba', 6.5130, 3.3820, 'Lagos Mainland', 'hospital'],
    ['Lagos State University Teaching Hospital', 'lasuth|lasuth ikeja', 6.5950, 3.3410, 'Ikeja', 'hospital'],
    ['St. Nicholas Hospital', 'st nicholas lagos|st nicholas hospital', 6.4490, 3.4260, 'Lagos Island', 'hospital'],
    ['Reddington Hospital', 'reddington hospital lagos', 6.4330, 3.4290, 'Victoria Island', 'hospital'],
    ['First Consultants Medical Center', 'first consultants ikoyi', 6.4510, 3.4320, 'Ikoyi', 'hospital'],
    ['Cedarcrest Hospital', 'cedarcrest hospital lagos', 6.4470, 3.4220, 'Victoria Island', 'hospital'],

    // --- Universities / Schools ---
    ['University of Lagos', 'unilag|university of lagos akoka', 6.5160, 3.3880, 'Yaba', 'school'],
    ['Lagos State University', 'lasu|lasu ojo', 6.5050, 3.3610, 'Ojo', 'school'],
    ['Yaba College of Technology', 'yabatech|yaba tech', 6.5090, 3.3730, 'Yaba', 'school'],
    ['Covenant University', 'covenant university ota', 6.5660, 3.3410, 'Ota', 'school'],
    ['Pan-Atlantic University', 'pan atlantic|pan atlantic university|lbs', 6.4310, 3.4930, 'Ibeju-Lekki', 'school'],

    // --- Landmarks / Leisure ---
    ['National Theatre', 'national theatre lagos|national arts theatre', 6.4860, 3.3670, 'Iganmu', 'landmark'],
    ['Tafawa Balewa Square', 'tbs lagos|tafawa balewa square', 6.4430, 3.4070, 'Lagos Island', 'landmark'],
    ['Lekki Conservation Centre', 'lekki conservation|canopy walkway lekki', 6.4360, 3.5280, 'Lekki', 'landmark'],
    ['Nike Art Gallery', 'nike art gallery lekki|nike gallery', 6.4310, 3.5080, 'Lekki', 'landmark'],
    ['Lekki Free Trade Zone', 'lekki ftz|free trade zone', 6.4180, 3.5350, 'Ibeju-Lekki', 'landmark'],
    ['Elegushi Beach', 'elegushi beach lekki|elegushi', 6.4340, 3.4930, 'Lekki', 'landmark'],
    ['Tarkwa Bay Beach', 'tarkwa bay', 6.3970, 3.3990, 'Lagos Island', 'landmark'],
    ['Bar Beach', 'bar beach victoria island', 6.4280, 3.4140, 'Victoria Island', 'landmark'],
    ['Oniru Beach', 'oniru beach|oniru', 6.4340, 3.4280, 'Victoria Island', 'landmark'],
    ['Lekki Beach', 'lekki beach', 6.4350, 3.4950, 'Lekki', 'landmark'],

    // --- Religious / Cultural ---
    ['Synagogue Church of All Nations', 'scoan|tb joshua|synagogue ikotun', 6.5280, 3.2740, 'Ikotun', 'landmark'],
    ['Redeemed Christian Church HQ', 'rccg redemption camp|redemption camp', 6.5400, 3.3760, 'Mowe', 'landmark'],
    ['National Mosque Abuja', 'national mosque|abuja national mosque', 9.0580, 7.4850, 'Abuja', 'landmark'],
    ['National Christian Centre', 'national ecumenical centre|abuja christian centre', 9.0600, 7.4880, 'Abuja', 'landmark'],

    // --- Government ---
    ['Lagos State Secretariat', 'alausa secretariat|lagos state secretariat alausa', 6.6030, 3.3520, 'Ikeja', 'landmark'],
    ['Lagos State Government House', 'government house alausa|state house alausa', 6.6050, 3.3540, 'Ikeja', 'landmark'],
    ['Aso Rock', 'aso rock abuja|presidential villa abuja', 9.0760, 7.4890, 'Abuja', 'landmark'],
    ['National Assembly', 'national assembly abuja', 9.0630, 7.4910, 'Abuja', 'landmark'],

    // --- Fuel stations (landmark-grade) ---
    ['Total Filling Station Maryland', 'total maryland|total station maryland', 6.5680, 3.3520, 'Maryland', 'landmark'],
    ['Total Filling Station Ikeja', 'total ikeja|total station ikeja along', 6.5880, 3.3490, 'Ikeja', 'landmark'],
    ['NNPC Mega Station', 'nnpc mega station lagos|nnpc ikorodu road', 6.5560, 3.3710, 'Ikorodu Road', 'landmark'],

    // --- Banks / Business ---
    ['Victoria Island Business District', 'vi business district|v.i business', 6.4280, 3.4220, 'Victoria Island', 'landmark'],
    ['Adeola Odeku', 'adeola odeku street|adeola odeku vi', 6.4300, 3.4180, 'Victoria Island', 'landmark'],
    ['Akin Adesola Street', 'akin adesola|akin adesola vi', 6.4310, 3.4210, 'Victoria Island', 'landmark'],
    ['Walter Carrington', 'walter carrington crescent|walter carrington vi', 6.4290, 3.4170, 'Victoria Island', 'landmark'],

    // --- Other notable ---
    ['Apapa Port', 'apapa wharf|lagos port|tin can island port', 6.4520, 3.3570, 'Apapa', 'landmark'],
    ['Tin Can Island Port', 'tin can island|tin can port', 6.4630, 3.3490, 'Apapa', 'landmark'],
    ['Dangote Refinery', 'dangote refinery lekki|dangote lekki', 6.4180, 3.5350, 'Ibeju-Lekki', 'landmark'],
    ['Lekki Deep Sea Port', 'lekki deep sea port|lekki port', 6.4180, 3.5350, 'Ibeju-Lekki', 'landmark'],
    ['Lekki Phase 1 Gate', 'lekki phase 1 gate|lekki 1 gate', 6.4350, 3.4750, 'Lekki', 'landmark'],
    ['Ikoyi Link Bridge', 'ikoyi link bridge|ikoyi bridge', 6.4490, 3.4270, 'Ikoyi', 'landmark'],
    ['Lekki-Ikoyi Link Bridge', 'lekki ikoyi link bridge|lekki ikoyi bridge', 6.4490, 3.4490, 'Lekki', 'landmark'],
    ['Third Mainland Bridge', 'third mainland bridge lagos', 6.5060, 3.3990, 'Lagos Mainland', 'landmark'],
    ['Eko Bridge', 'eko bridge lagos', 6.4530, 3.3890, 'Lagos Island', 'landmark'],
    ['Carter Bridge', 'carter bridge lagos', 6.4530, 3.3840, 'Lagos Island', 'landmark'],
  ];

  const tx = db.transaction(() => {
    for (const s of seeds) insert.run(...s);
  });
  tx();
  console.log(`Seeded ${seeds.length} Lagos landmarks`);
}
