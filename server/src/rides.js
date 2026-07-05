// Ride REST API: estimates, requests, lifecycle actions, history, earnings, payments.
import db from './db.js';
import { authRequired } from './auth.js';
import { TIERS, estimateAll, computeSurge, haversineM } from './fares.js';
import { getRoute } from './routing.js';
import { drivers, onlineIdleDrivers, simRides } from './state.js';
import { getRide, rideToJson, updateRide, broadcastRide } from './ridecore.js';
import { startMatching, cancelMatching } from './matching.js';

const ACTIVE_STATUSES = ['requested', 'matching', 'accepted', 'arrived', 'in_progress'];

function currentSurge() {
  const activeRides = db.prepare(
    `SELECT COUNT(*) AS n FROM rides WHERE status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`
  ).get(...ACTIVE_STATUSES).n;
  return computeSurge({ activeRides, idleDrivers: onlineIdleDrivers().length });
}

export function registerRideRoutes(app) {
  // Fare estimate for all tiers + route preview
  app.post('/api/rides/estimate', authRequired, async (req, res) => {
    const { pickup, drop } = req.body || {};
    if (!pickup?.lat || !drop?.lat) return res.status(400).json({ error: 'pickup and drop required' });
    const route = await getRoute(pickup.lat, pickup.lng, drop.lat, drop.lng);
    const surge = currentSurge();
    res.json({
      distanceM: Math.round(route.distanceM),
      durationS: Math.round(route.durationS),
      surge,
      route: route.points,
      tiers: estimateAll(route.distanceM, route.durationS, surge),
      nearbyDrivers: countNearby(pickup.lat, pickup.lng),
    });
  });

  function countNearby(lat, lng) {
    return onlineIdleDrivers().filter((d) => haversineM(lat, lng, d.lat, d.lng) < 8000).length;
  }

  // Request a ride
  app.post('/api/rides', authRequired, async (req, res) => {
    if (req.user.role !== 'rider') return res.status(403).json({ error: 'Only riders can request rides' });
    const { pickup, drop, tier, paymentMethod } = req.body || {};
    if (!pickup?.lat || !drop?.lat || !TIERS[tier]) return res.status(400).json({ error: 'pickup, drop and valid tier required' });

    const existing = db.prepare(
      `SELECT * FROM rides WHERE rider_id = ? AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`
    ).get(req.user.id, ...ACTIVE_STATUSES);
    if (existing) return res.status(409).json({ error: 'You already have an active ride', ride: rideToJson(existing) });

    const route = await getRoute(pickup.lat, pickup.lng, drop.lat, drop.lng);
    const surge = currentSurge();
    const fare = estimateAll(route.distanceM, route.durationS, surge).find((t) => t.key === tier).fare;

    const info = db.prepare(`
      INSERT INTO rides (rider_id, status, tier, pickup_lat, pickup_lng, pickup_addr,
        drop_lat, drop_lng, drop_addr, distance_m, duration_s, fare, surge, payment_method, route_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(req.user.id, 'requested', tier, pickup.lat, pickup.lng, pickup.addr || null,
      drop.lat, drop.lng, drop.addr || null, Math.round(route.distanceM), Math.round(route.durationS),
      fare, surge, paymentMethod || 'Cash', JSON.stringify(route.points));

    const ride = getRide(info.lastInsertRowid);
    res.json({ ride: rideToJson(ride) });
    startMatching(ride.id);
  });

  // Current active ride (rider or driver)
  app.get('/api/rides/current', authRequired, (req, res) => {
    const col = req.user.role === 'driver' ? 'driver_id' : 'rider_id';
    const ride = db.prepare(
      `SELECT * FROM rides WHERE ${col} = ? AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')}) ORDER BY id DESC`
    ).get(req.user.id, ...ACTIVE_STATUSES);
    res.json({ ride: rideToJson(ride) });
  });

  app.get('/api/rides/history', authRequired, (req, res) => {
    const col = req.user.role === 'driver' ? 'driver_id' : 'rider_id';
    const rides = db.prepare(
      `SELECT * FROM rides WHERE ${col} = ? AND status IN ('completed','cancelled') ORDER BY id DESC LIMIT 50`
    ).all(req.user.id);
    res.json({ rides: rides.map((r) => rideToJson(r)) });
  });

  app.post('/api/rides/:id/cancel', authRequired, (req, res) => {
    const ride = getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    const isRider = ride.rider_id === req.user.id;
    const isDriver = ride.driver_id === req.user.id;
    if (!isRider && !isDriver) return res.status(403).json({ error: 'Not your ride' });
    if (!['requested', 'matching', 'accepted', 'arrived'].includes(ride.status)) {
      return res.status(400).json({ error: 'Ride can no longer be cancelled' });
    }
    cancelMatching(ride.id);
    simRides.delete(ride.id);
    if (ride.driver_id) {
      const d = drivers.get(ride.driver_id);
      if (d) d.status = 'idle';
    }
    // $2 cancellation fee if a driver had already accepted (rider-cancelled)
    const fee = isRider && ['accepted', 'arrived'].includes(ride.status) ? 2 : 0;
    const updated = updateRide(ride.id, {
      status: 'cancelled', cancelled_by: isRider ? 'rider' : 'driver', fare: fee,
    });
    res.json({ ride: broadcastRide(updated) });
  });

  // Driver trip lifecycle
  const driverAction = (from, to, stamp) => (req, res) => {
    const ride = getRide(req.params.id);
    if (!ride || ride.driver_id !== req.user.id) return res.status(403).json({ error: 'Not your ride' });
    if (ride.status !== from) return res.status(400).json({ error: `Ride is not in '${from}' state` });
    const fields = { status: to };
    if (stamp) fields[stamp] = new Date().toISOString();
    const updated = updateRide(ride.id, fields);
    if (to === 'completed') {
      const d = drivers.get(ride.driver_id);
      if (d) d.status = 'idle';
    }
    res.json({ ride: broadcastRide(updated) });
  };
  app.post('/api/rides/:id/arrived', authRequired, driverAction('accepted', 'arrived', 'arrived_at'));
  app.post('/api/rides/:id/start', authRequired, driverAction('arrived', 'in_progress', 'started_at'));
  app.post('/api/rides/:id/complete', authRequired, driverAction('in_progress', 'completed', 'completed_at'));

  // Rate + tip after completion
  app.post('/api/rides/:id/rate', authRequired, (req, res) => {
    const ride = getRide(req.params.id);
    if (!ride || ride.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your ride' });
    if (ride.status !== 'completed') return res.status(400).json({ error: 'Ride is not completed' });
    if (ride.rating) return res.status(400).json({ error: 'Already rated' });
    const rating = Math.min(5, Math.max(1, Math.round(req.body?.rating || 5)));
    const tip = Math.max(0, Number(req.body?.tip) || 0);
    const updated = updateRide(ride.id, { rating, tip });
    if (ride.driver_id) {
      db.prepare('UPDATE users SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?')
        .run(rating, ride.driver_id);
    }
    res.json({ ride: rideToJson(updated) });
  });

  // Driver earnings dashboard
  app.get('/api/driver/earnings', authRequired, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Drivers only' });
    const all = db.prepare(
      "SELECT * FROM rides WHERE driver_id = ? AND status = 'completed' ORDER BY id DESC"
    ).all(req.user.id);
    const sum = (rows) => Math.round(rows.reduce((s, r) => s + r.fare + r.tip, 0) * 100) / 100;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    res.json({
      today: sum(all.filter((r) => (r.completed_at || '').slice(0, 10) === today)),
      week: sum(all.filter((r) => (r.completed_at || '') >= weekAgo)),
      total: sum(all),
      trips: all.length,
      recent: all.slice(0, 20).map((r) => rideToJson(r)),
    });
  });

  // Nearby cars preview for the rider map
  app.get('/api/drivers/nearby', authRequired, (req, res) => {
    const lat = Number(req.query.lat), lng = Number(req.query.lng);
    if (!lat || !lng) return res.json({ drivers: [] });
    const near = onlineIdleDrivers()
      .map((d) => ({ id: d.id, lat: d.lat, lng: d.lng, heading: d.heading || 0, dist: haversineM(lat, lng, d.lat, d.lng) }))
      .filter((d) => d.dist < 8000)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12);
    res.json({ drivers: near });
  });

  // Mock payment methods
  app.get('/api/payments', authRequired, (req, res) => {
    const methods = db.prepare('SELECT * FROM payment_methods WHERE user_id = ?').all(req.user.id);
    res.json({ methods });
  });
  app.post('/api/payments', authRequired, (req, res) => {
    const { brand, last4, label } = req.body || {};
    if (!brand || !last4) return res.status(400).json({ error: 'brand and last4 required' });
    db.prepare('INSERT INTO payment_methods (user_id, brand, last4, label) VALUES (?,?,?,?)')
      .run(req.user.id, brand, String(last4).slice(-4), label || `${brand} •••• ${String(last4).slice(-4)}`);
    const methods = db.prepare('SELECT * FROM payment_methods WHERE user_id = ?').all(req.user.id);
    res.json({ methods });
  });
  app.delete('/api/payments/:id', authRequired, (req, res) => {
    db.prepare('DELETE FROM payment_methods WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    const methods = db.prepare('SELECT * FROM payment_methods WHERE user_id = ?').all(req.user.id);
    res.json({ methods });
  });
}
