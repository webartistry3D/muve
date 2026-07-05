// Socket.io: presence, live driver locations, ride offers.
import db from './db.js';
import { verifyToken } from './auth.js';
import { drivers, userSockets, emitToUser } from './state.js';
import { acceptOffer, declineOffer } from './matching.js';
import { getRide } from './ridecore.js';

const ACTIVE = ['accepted', 'arrived', 'in_progress'];

function activeRideForDriver(driverId) {
  return db.prepare(
    `SELECT * FROM rides WHERE driver_id = ? AND status IN (${ACTIVE.map(() => '?').join(',')}) ORDER BY id DESC`
  ).get(driverId, ...ACTIVE);
}

export function registerSockets(io) {
  io.use((socket, next) => {
    const payload = verifyToken(socket.handshake.auth?.token || '');
    if (!payload) return next(new Error('unauthorized'));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (!userSockets.has(user.id)) userSockets.set(user.id, new Set());
    userSockets.get(user.id).add(socket.id);

    if (user.role === 'driver') {
      socket.on('driver:online', ({ lat, lng } = {}) => {
        const existing = drivers.get(user.id);
        drivers.set(user.id, {
          lat: lat ?? existing?.lat ?? 0,
          lng: lng ?? existing?.lng ?? 0,
          heading: existing?.heading ?? 0,
          status: existing?.status === 'busy' ? 'busy' : 'idle',
          isSim: false,
          socketId: socket.id,
        });
        socket.emit('driver:status', { online: true });
      });

      socket.on('driver:offline', () => {
        const d = drivers.get(user.id);
        if (d && d.status !== 'busy') drivers.delete(user.id);
        socket.emit('driver:status', { online: false });
      });

      socket.on('driver:location', ({ lat, lng, heading } = {}) => {
        const d = drivers.get(user.id);
        if (!d || typeof lat !== 'number') return;
        d.lat = lat; d.lng = lng; d.heading = heading || 0;
        const ride = activeRideForDriver(user.id);
        if (ride) {
          emitToUser(ride.rider_id, 'driver:location', { rideId: ride.id, driverId: user.id, lat, lng, heading: heading || 0 });
        }
      });

      socket.on('offer:accept', ({ rideId } = {}) => {
        const ok = acceptOffer(user.id, rideId);
        if (!ok) socket.emit('ride:offer:closed', { rideId, reason: 'expired' });
      });
      socket.on('offer:decline', ({ rideId } = {}) => declineOffer(user.id, rideId));
    }

    socket.on('disconnect', () => {
      const set = userSockets.get(user.id);
      if (set) {
        set.delete(socket.id);
        if (!set.size) userSockets.delete(user.id);
      }
      // Real driver fully disconnected: drop from map unless mid-trip
      if (user.role === 'driver' && !userSockets.has(user.id)) {
        const d = drivers.get(user.id);
        if (d && !d.isSim && d.status !== 'busy') drivers.delete(user.id);
      }
    });
  });
}
