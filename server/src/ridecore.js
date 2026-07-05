// Shared ride helpers: serialization, updates, realtime broadcast.
import db from './db.js';
import { publicUser } from './auth.js';
import { drivers, emitToUser } from './state.js';

export function getRide(id) {
  return db.prepare('SELECT * FROM rides WHERE id = ?').get(id);
}

export function rideToJson(ride, extra = {}) {
  if (!ride) return null;
  const rider = db.prepare('SELECT * FROM users WHERE id = ?').get(ride.rider_id);
  const driver = ride.driver_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(ride.driver_id) : null;
  const live = ride.driver_id ? drivers.get(ride.driver_id) : null;
  return {
    id: ride.id,
    status: ride.status,
    tier: ride.tier,
    pickup: { lat: ride.pickup_lat, lng: ride.pickup_lng, addr: ride.pickup_addr },
    drop: { lat: ride.drop_lat, lng: ride.drop_lng, addr: ride.drop_addr },
    distanceM: ride.distance_m,
    durationS: ride.duration_s,
    fare: ride.fare,
    surge: ride.surge,
    tip: ride.tip,
    rating: ride.rating,
    paymentMethod: ride.payment_method,
    route: ride.route_json ? JSON.parse(ride.route_json) : null,
    rider: publicUser(rider),
    driver: publicUser(driver),
    driverLocation: live ? { lat: live.lat, lng: live.lng, heading: live.heading || 0 } : null,
    cancelledBy: ride.cancelled_by,
    requestedAt: ride.requested_at,
    acceptedAt: ride.accepted_at,
    startedAt: ride.started_at,
    completedAt: ride.completed_at,
    ...extra,
  };
}

export function updateRide(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length) {
    db.prepare(`UPDATE rides SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => fields[k]), id);
  }
  return getRide(id);
}

export function broadcastRide(ride, extra = {}) {
  const json = rideToJson(ride, extra);
  emitToUser(ride.rider_id, 'ride:update', json);
  if (ride.driver_id) emitToUser(ride.driver_id, 'ride:update', json);
  return json;
}
