// Driver matching: offer the ride to the nearest idle drivers one at a time,
// with timeouts. Sim drivers auto-accept after a short "thinking" delay.
import db from './db.js';
import { drivers, pendingOffers, emitToUser } from './state.js';
import { haversineM } from './fares.js';
import { getRide, updateRide, broadcastRide, rideToJson } from './ridecore.js';
import { ensureSimFleet, startSimTrip } from './sim.js';

const OFFER_TIMEOUT_MS = 30000;

export function startMatching(rideId) {
  const ride = getRide(rideId);
  if (!ride) return;
  const simMode = process.env.SIM_MODE !== 'false';
  if (simMode) ensureSimFleet(ride.pickup_lat, ride.pickup_lng, ride.tier);

  const candidates = [...drivers.entries()]
    .filter(([id, d]) => {
      if (d.status !== 'idle') return false;
      if (!simMode && d.isSim) return false; // skip sim drivers when sim mode is off
      const u = db.prepare('SELECT vehicle_tier FROM users WHERE id = ?').get(id);
      return u?.vehicle_tier === ride.tier;
    })
    .map(([id, d]) => ({ id, dist: haversineM(ride.pickup_lat, ride.pickup_lng, d.lat, d.lng) }))
    .sort((a, b) => a.dist - b.dist)
    .map((c) => c.id);

  pendingOffers.set(rideId, { candidates, declined: new Set(), driverId: null, timer: null });
  broadcastRide(updateRide(rideId, { status: 'matching' }));
  offerNext(rideId);
}

function offerNext(rideId) {
  const offer = pendingOffers.get(rideId);
  const ride = getRide(rideId);
  if (!offer || !ride || ride.status !== 'matching') return;

  const nextId = offer.candidates.find((id) => {
    const d = drivers.get(id);
    return d && d.status === 'idle' && !offer.declined.has(id);
  });

  if (nextId === undefined) {
    // Nobody left — spawn fresh sim capacity and retry once (only in sim mode)
    if (process.env.SIM_MODE !== 'false') ensureSimFleet(ride.pickup_lat, ride.pickup_lng, ride.tier, 5);
    const retry = [...drivers.entries()]
      .filter(([id, d]) => d.status === 'idle' && !offer.declined.has(id) &&
        !(process.env.SIM_MODE === 'false' && d.isSim) &&
        db.prepare('SELECT vehicle_tier FROM users WHERE id = ?').get(id)?.vehicle_tier === ride.tier)
      .map(([id]) => id);
    if (!retry.length) {
      pendingOffers.delete(rideId);
      broadcastRide(updateRide(rideId, { status: 'cancelled', cancelled_by: 'system' }), { reason: 'No drivers available' });
      return;
    }
    offer.candidates = retry;
    return offerNext(rideId);
  }

  const d = drivers.get(nextId);
  d.status = 'offered';
  offer.driverId = nextId;

  if (d.isSim) {
    // Sim drivers: if rider proposed a fare below suggested, sometimes counter
    if (ride.fare_status === 'proposed' && ride.suggested_fare && ride.fare < ride.suggested_fare * 0.85) {
      offer.timer = setTimeout(() => {
        const counterFare = Math.round(ride.suggested_fare * 0.9);
        updateRide(rideId, { fare: counterFare, fare_status: 'countered' });
        broadcastRide(getRide(rideId), { counterFare });
      }, 1500 + Math.random() * 2000);
    } else {
      offer.timer = setTimeout(() => acceptOffer(nextId, rideId), 1500 + Math.random() * 2500);
    }
  } else {
    emitToUser(nextId, 'ride:offer', rideToJson(ride, {
      pickupDistM: Math.round(haversineM(ride.pickup_lat, ride.pickup_lng, d.lat, d.lng)),
      expiresInS: OFFER_TIMEOUT_MS / 1000,
    }));
    offer.timer = setTimeout(() => declineOffer(nextId, rideId, true), OFFER_TIMEOUT_MS);
  }
}

export function acceptOffer(driverId, rideId) {
  const offer = pendingOffers.get(rideId);
  const ride = getRide(rideId);
  if (!offer || offer.driverId !== driverId || !ride || ride.status !== 'matching') return false;
  clearTimeout(offer.timer);
  pendingOffers.delete(rideId);

  const d = drivers.get(driverId);
  if (d) d.status = 'busy';
  const updated = updateRide(rideId, {
    status: 'accepted', driver_id: driverId, accepted_at: new Date().toISOString(),
  });
  broadcastRide(updated);
  if (d?.isSim) startSimTrip(rideId, driverId);
  return true;
}

export function declineOffer(driverId, rideId, isTimeout = false) {
  const offer = pendingOffers.get(rideId);
  if (!offer || offer.driverId !== driverId) return false;
  clearTimeout(offer.timer);
  // If ride is in 'countered' state, don't wipe the offer — rider hasn't responded yet
  const ride = getRide(rideId);
  if (ride && ride.fare_status === 'countered') return true;
  offer.declined.add(driverId);
  offer.driverId = null;
  const d = drivers.get(driverId);
  if (d && d.status === 'offered') d.status = 'idle';
  if (!isTimeout) emitToUser(driverId, 'ride:offer:closed', { rideId });
  offerNext(rideId);
  return true;
}

// Driver counters the fare — pause matching, wait for rider response
export function counterOffer(driverId, rideId, counterFare) {
  const offer = pendingOffers.get(rideId);
  if (!offer || offer.driverId !== driverId) return false;
  clearTimeout(offer.timer);
  // Keep the driver as offered but don't time out — rider needs to respond
  // The ride stays in 'matching' status with fare_status='countered'
  return true;
}

// Called when a ride gets cancelled while an offer is in flight
export function cancelMatching(rideId) {
  const offer = pendingOffers.get(rideId);
  if (!offer) return;
  clearTimeout(offer.timer);
  if (offer.driverId) {
    const d = drivers.get(offer.driverId);
    if (d && d.status === 'offered') d.status = 'idle';
    emitToUser(offer.driverId, 'ride:offer:closed', { rideId });
  }
  pendingOffers.delete(rideId);
}
