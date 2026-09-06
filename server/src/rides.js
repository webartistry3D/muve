// Ride REST API: estimates, requests, lifecycle actions, history, earnings, payments.
import db from './db.js';
import { authRequired } from './auth.js';
import { TIERS, estimateAll, computeSurge, haversineM } from './fares.js';
import { getRoute } from './routing.js';
import { drivers, onlineIdleDrivers, simRides, pendingOffers, emitToUser } from './state.js';
import { getRide, rideToJson, updateRide, broadcastRide } from './ridecore.js';
import { startMatching, cancelMatching, acceptOffer, counterOffer } from './matching.js';

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
    const { pickup, drop, tier, paymentMethod, proposedFare } = req.body || {};
    if (!pickup?.lat || !drop?.lat || !TIERS[tier]) return res.status(400).json({ error: 'pickup, drop and valid tier required' });

    const existing = db.prepare(
      `SELECT * FROM rides WHERE rider_id = ? AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`
    ).get(req.user.id, ...ACTIVE_STATUSES);
    if (existing) return res.status(409).json({ error: 'You already have an active ride', ride: rideToJson(existing) });

    const route = await getRoute(pickup.lat, pickup.lng, drop.lat, drop.lng);
    const surge = currentSurge();
    const suggestedFare = estimateAll(route.distanceM, route.durationS, surge).find((t) => t.key === tier).fare;

    // If rider proposed a fare, use it as the proposed fare; fare_status starts as 'proposed'
    // If no proposal, fare = suggested fare and status is 'agreed' (standard flow)
    const hasProposal = proposedFare != null && Number(proposedFare) > 0;
    const fare = hasProposal ? Number(proposedFare) : suggestedFare;
    const fareStatus = hasProposal ? 'proposed' : 'agreed';

    const info = db.prepare(`
      INSERT INTO rides (rider_id, status, tier, pickup_lat, pickup_lng, pickup_addr,
        drop_lat, drop_lng, drop_addr, distance_m, duration_s, fare, suggested_fare, proposed_fare, fare_status, surge, payment_method, route_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(req.user.id, 'requested', tier, pickup.lat, pickup.lng, pickup.addr || null,
      drop.lat, drop.lng, drop.addr || null, Math.round(route.distanceM), Math.round(route.durationS),
      fare, suggestedFare, hasProposal ? fare : null, fareStatus, surge, paymentMethod || 'Cash', JSON.stringify(route.points));

    const ride = getRide(info.lastInsertRowid);
    res.json({ ride: rideToJson(ride) });
    startMatching(ride.id);
  });

  // Driver counters a proposed fare
  app.post('/api/rides/:id/counter', authRequired, (req, res) => {
    const ride = getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    // During matching, driver_id isn't set yet — check pending offer
    const offer = pendingOffers.get(ride.id);
    const isOfferedDriver = offer && offer.driverId === req.user.id;
    const isAssignedDriver = ride.driver_id === req.user.id;
    if (!isOfferedDriver && !isAssignedDriver) return res.status(403).json({ error: 'Not your ride' });
    if (ride.fare_status !== 'proposed') return res.status(400).json({ error: 'Ride fare is not in negotiation' });
    const counterFare = Number(req.body?.fare);
    if (!counterFare || counterFare <= 0) return res.status(400).json({ error: 'Valid counter fare required' });
    counterOffer(req.user.id, ride.id, counterFare); // clear offer timer, keep driver as offered
    const updated = updateRide(ride.id, { fare: counterFare, fare_status: 'countered' });
    broadcastRide(updated, { counterFare });
    res.json({ ride: rideToJson(updated) });
  });

  // Rider accepts a counter-offer
  app.post('/api/rides/:id/accept-counter', authRequired, (req, res) => {
    const ride = getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your ride' });
    if (ride.fare_status !== 'countered') return res.status(400).json({ error: 'No counter to accept' });
    const updated = updateRide(ride.id, { fare_status: 'agreed' });
    // Auto-accept by the driver who countered
    const offer = pendingOffers.get(ride.id);
    if (offer && offer.driverId) {
      acceptOffer(offer.driverId, ride.id);
    } else {
      broadcastRide(updated);
    }
    res.json({ ride: rideToJson(updated) });
  });

  // Rider declines a counter-offer (cancels the ride)
  app.post('/api/rides/:id/decline-counter', authRequired, (req, res) => {
    const ride = getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your ride' });
    if (ride.fare_status !== 'countered') return res.status(400).json({ error: 'No counter to decline' });
    cancelMatching(ride.id);
    const offer = pendingOffers.get(ride.id);
    if (offer && offer.driverId) {
      const d = drivers.get(offer.driverId);
      if (d && d.status === 'offered') d.status = 'idle';
      emitToUser(offer.driverId, 'ride:offer:closed', { rideId: ride.id, reason: 'counter_declined' });
    }
    const updated = updateRide(ride.id, { status: 'cancelled', cancelled_by: 'rider', fare_status: 'rejected' });
    broadcastRide(updated);
    res.json({ ride: rideToJson(updated) });
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
    // ₦200 cancellation fee if a driver had already accepted (rider-cancelled)
    const fee = isRider && ['accepted', 'arrived'].includes(ride.status) ? 200 : 0;
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

  // Driver expenses
  const EXPENSE_CATEGORIES = ['Fuel', 'Repairs', 'Maintenance', 'Insurance', 'Other'];

  app.get('/api/driver/expenses', authRequired, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Drivers only' });
    const expenses = db.prepare('SELECT * FROM expenses WHERE driver_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
    const sum = (rows) => Math.round(rows.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    res.json({
      today: sum(expenses.filter((e) => (e.created_at || '').slice(0, 10) === today)),
      week: sum(expenses.filter((e) => (e.created_at || '') >= weekAgo)),
      total: sum(expenses),
      expenses: expenses.map((e) => ({
        id: e.id, category: e.category, amount: e.amount, note: e.note, createdAt: e.created_at,
      })),
      categories: EXPENSE_CATEGORIES,
    });
  });

  app.post('/api/driver/expenses', authRequired, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Drivers only' });
    const { category, amount, note } = req.body || {};
    if (!category || !EXPENSE_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Valid category required' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Valid amount required' });
    db.prepare('INSERT INTO expenses (driver_id, category, amount, note) VALUES (?,?,?,?)')
      .run(req.user.id, category, Number(amount), note || null);
    const expenses = db.prepare('SELECT * FROM expenses WHERE driver_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
    const sum = (rows) => Math.round(rows.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    res.json({
      today: sum(expenses.filter((e) => (e.created_at || '').slice(0, 10) === today)),
      week: sum(expenses.filter((e) => (e.created_at || '') >= weekAgo)),
      total: sum(expenses),
      expenses: expenses.map((e) => ({
        id: e.id, category: e.category, amount: e.amount, note: e.note, createdAt: e.created_at,
      })),
      categories: EXPENSE_CATEGORIES,
    });
  });

  app.delete('/api/driver/expenses/:id', authRequired, (req, res) => {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'Drivers only' });
    db.prepare('DELETE FROM expenses WHERE id = ? AND driver_id = ?').run(req.params.id, req.user.id);
    const expenses = db.prepare('SELECT * FROM expenses WHERE driver_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
    const sum = (rows) => Math.round(rows.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    res.json({
      today: sum(expenses.filter((e) => (e.created_at || '').slice(0, 10) === today)),
      week: sum(expenses.filter((e) => (e.created_at || '') >= weekAgo)),
      total: sum(expenses),
      expenses: expenses.map((e) => ({
        id: e.id, category: e.category, amount: e.amount, note: e.note, createdAt: e.created_at,
      })),
      categories: EXPENSE_CATEGORIES,
    });
  });

  // Nearby cars preview for the rider map
  app.get('/api/drivers/nearby', authRequired, (req, res) => {
    const lat = Number(req.query.lat), lng = Number(req.query.lng);
    if (!lat || !lng) return res.json({ drivers: [] });
    const simMode = process.env.SIM_MODE !== 'false';
    const near = onlineIdleDrivers()
      .filter((d) => simMode || !d.isSim) // hide sim drivers when sim mode is off
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
