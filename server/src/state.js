// In-memory presence & live state. DB is the source of truth for rides/users;
// this tracks who is online, where drivers are, and pending offers.

export const drivers = new Map(); // driverId -> { lat,lng,heading, status:'idle'|'offered'|'busy', isSim, socketId }
export const userSockets = new Map(); // userId -> Set<socketId>
export const pendingOffers = new Map(); // rideId -> { driverId, timer, candidates:[], declined:Set }
export const simRides = new Map(); // rideId -> sim trip state

export function onlineIdleDrivers() {
  return [...drivers.entries()]
    .filter(([, d]) => d.status === 'idle')
    .map(([id, d]) => ({ id, ...d }));
}

export function setDriverStatus(driverId, status) {
  const d = drivers.get(driverId);
  if (d) d.status = status;
}

let ioRef = null;
export function setIO(io) { ioRef = io; }
export function getIO() { return ioRef; }

export function emitToUser(userId, event, payload) {
  if (ioRef) ioRef.to(`user:${userId}`).emit(event, payload);
}
