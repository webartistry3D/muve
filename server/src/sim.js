// Simulated driver fleet: spawns AI drivers near riders, roams them while idle,
// and drives them along real road routes when assigned a trip.
import db from './db.js';
import { drivers, simRides, emitToUser } from './state.js';
import { getRoute } from './routing.js';
import { haversineM } from './fares.js';
import { getRide, updateRide, broadcastRide } from './ridecore.js';

const FIRST = ['Aarav', 'Maya', 'Leo', 'Sofia', 'Kiran', 'Nina', 'Omar', 'Elena', 'Ravi', 'Zoe', 'Marco', 'Priya', 'Dev', 'Lena', 'Sam'];
const LAST = ['Sharma', 'Costa', 'Kim', 'Patel', 'Novak', 'Reyes', 'Iyer', 'Silva', 'Khan', 'Mori', 'Diaz', 'Rao'];
const CARS = {
  zberx: [['Toyota', 'Prius'], ['Honda', 'Civic'], ['Hyundai', 'Elantra'], ['Suzuki', 'Swift']],
  zberxl: [['Toyota', 'Innova'], ['Honda', 'Odyssey'], ['Kia', 'Carnival']],
  black: [['Mercedes', 'E-Class'], ['BMW', '5 Series'], ['Audi', 'A6']],
};
const COLORS = ['Black', 'White', 'Silver', 'Blue', 'Grey'];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const plate = () => `ZB ${Math.floor(1000 + Math.random() * 9000)}`;

function createSimDriver(tier, lat, lng) {
  const name = `${rand(FIRST)} ${rand(LAST)}`;
  const [make, model] = rand(CARS[tier] || CARS.zberx);
  const email = `sim_${Date.now()}_${Math.floor(Math.random() * 1e6)}@sim.zber`;
  const info = db.prepare(`
    INSERT INTO users (name,email,password_hash,role,is_sim,rating_sum,rating_count,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,vehicle_tier)
    VALUES (?,?,?,?,1,?,?,?,?,?,?,?)
  `).run(name, email, 'x', 'driver',
    (4.5 + Math.random() * 0.5) * 120, 120, // seeded ratings: 4.5-5.0 over 120 trips
    make, model, plate(), rand(COLORS), tier);
  const id = info.lastInsertRowid;
  drivers.set(id, {
    lat: lat + (Math.random() - 0.5) * 0.02,
    lng: lng + (Math.random() - 0.5) * 0.02,
    heading: Math.random() * 360,
    status: 'idle', isSim: true, socketId: null,
  });
  return id;
}

// Guarantee enough idle sim drivers of this tier near the pickup point.
export function ensureSimFleet(lat, lng, tier, want = 4) {
  const nearbyIdle = [...drivers.entries()].filter(([id, d]) => {
    if (d.status !== 'idle' || !d.isSim) return false;
    const u = db.prepare('SELECT vehicle_tier FROM users WHERE id = ?').get(id);
    return u?.vehicle_tier === tier && haversineM(lat, lng, d.lat, d.lng) < 6000;
  });
  // Reposition far-away idle sims of the right tier instead of endlessly creating new ones
  const farIdle = [...drivers.entries()].filter(([id, d]) => {
    if (d.status !== 'idle' || !d.isSim) return false;
    const u = db.prepare('SELECT vehicle_tier FROM users WHERE id = ?').get(id);
    return u?.vehicle_tier === tier && haversineM(lat, lng, d.lat, d.lng) >= 6000;
  });
  let deficit = want - nearbyIdle.length;
  while (deficit > 0 && farIdle.length) {
    const [, d] = farIdle.pop();
    d.lat = lat + (Math.random() - 0.5) * 0.02;
    d.lng = lng + (Math.random() - 0.5) * 0.02;
    deficit--;
  }
  while (deficit > 0) { createSimDriver(tier, lat, lng); deficit--; }
}

// Begin a sim trip: drive to pickup, wait, drive to destination, complete.
export async function startSimTrip(rideId, driverId) {
  const ride = getRide(rideId);
  const d = drivers.get(driverId);
  if (!ride || !d) return;
  const approach = await getRoute(d.lat, d.lng, ride.pickup_lat, ride.pickup_lng);
  const trip = ride.route_json
    ? { points: JSON.parse(ride.route_json), distanceM: ride.distance_m }
    : await getRoute(ride.pickup_lat, ride.pickup_lng, ride.drop_lat, ride.drop_lng);
  simRides.set(rideId, {
    driverId,
    phase: 'to_pickup',
    approach: prepPath(approach.points, 25), // reach pickup in ~25s
    trip: prepPath(trip.points, 60),          // complete trip in ~60s (demo pacing)
    waitUntil: 0,
  });
}

function prepPath(points, targetSeconds) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversineM(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]));
  }
  const total = cum[cum.length - 1] || 1;
  return { points, cum, total, speed: Math.max(8, total / targetSeconds), progress: 0 };
}

function positionAt(path, meters) {
  const { points, cum } = path;
  if (meters >= path.total) return { pos: points[points.length - 1], heading: bearingOf(points, points.length - 1) };
  let i = 1;
  while (i < cum.length && cum[i] < meters) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = (meters - cum[i - 1]) / segLen;
  const [aLat, aLng] = points[i - 1], [bLat, bLng] = points[i];
  return { pos: [aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t], heading: bearing(aLat, aLng, bLat, bLng) };
}

function bearingOf(points, i) {
  const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i)];
  return bearing(a[0], a[1], b[0], b[1]);
}
function bearing(lat1, lng1, lat2, lng2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function emitDriverLocation(ride, driverId) {
  const d = drivers.get(driverId);
  if (!d) return;
  const payload = { rideId: ride.id, driverId, lat: d.lat, lng: d.lng, heading: d.heading };
  emitToUser(ride.rider_id, 'driver:location', payload);
}

function tick() {
  // Roam idle sim drivers with a gentle random walk
  for (const [, d] of drivers) {
    if (!d.isSim || d.status !== 'idle') continue;
    d.heading = (d.heading + (Math.random() - 0.5) * 40 + 360) % 360;
    const step = 0.00012;
    d.lat += Math.cos((d.heading * Math.PI) / 180) * step;
    d.lng += Math.sin((d.heading * Math.PI) / 180) * step;
  }

  // Advance active sim trips
  for (const [rideId, st] of simRides) {
    const ride = getRide(rideId);
    if (!ride || ['completed', 'cancelled'].includes(ride.status)) {
      const d = drivers.get(st.driverId);
      if (d) d.status = 'idle';
      simRides.delete(rideId);
      continue;
    }
    const d = drivers.get(st.driverId);
    if (!d) { simRides.delete(rideId); continue; }

    if (st.phase === 'to_pickup') {
      st.approach.progress += st.approach.speed;
      const { pos, heading } = positionAt(st.approach, st.approach.progress);
      [d.lat, d.lng] = pos; d.heading = heading;
      emitDriverLocation(ride, st.driverId);
      if (st.approach.progress >= st.approach.total) {
        st.phase = 'waiting';
        st.waitUntil = Date.now() + 4000;
        broadcastRide(updateRide(rideId, { status: 'arrived', arrived_at: new Date().toISOString() }));
      }
    } else if (st.phase === 'waiting') {
      if (Date.now() >= st.waitUntil) {
        st.phase = 'to_drop';
        broadcastRide(updateRide(rideId, { status: 'in_progress', started_at: new Date().toISOString() }));
      }
    } else if (st.phase === 'to_drop') {
      st.trip.progress += st.trip.speed;
      const { pos, heading } = positionAt(st.trip, st.trip.progress);
      [d.lat, d.lng] = pos; d.heading = heading;
      emitDriverLocation(ride, st.driverId);
      if (st.trip.progress >= st.trip.total) {
        d.status = 'idle';
        simRides.delete(rideId);
        broadcastRide(updateRide(rideId, { status: 'completed', completed_at: new Date().toISOString() }));
      }
    }
  }
}

export function startSimEngine() {
  setInterval(tick, 1000);
}
