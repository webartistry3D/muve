// Fare engine: tiers, haversine distance, surge pricing, estimates.

export const TIERS = {
  muvex:  { key: 'muvex',  name: 'MuveX',     seats: 4, base: 350, perKm: 110, perMin: 20, minFare: 1000, icon: '🚗', blurb: 'Affordable, everyday rides' },
  muvexl: { key: 'muvexl', name: 'MuveXL',    seats: 6, base: 500, perKm: 160, perMin: 28, minFare: 1500, icon: '🚙', blurb: 'Extra room for groups' },
  black:  { key: 'black',  name: 'Muve Black', seats: 4, base: 800, perKm: 250, perMin: 40, minFare: 2000, icon: '🏴', blurb: 'Premium rides, top drivers' },
};

export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function computeSurge({ activeRides, idleDrivers }) {
  // inDrive model: no automated surge. Drivers bargain up instead.
  return 1;
}

export function fareFor(tierKey, distanceM, durationS, surge = 1) {
  const t = TIERS[tierKey];
  const raw = t.base + (distanceM / 1000) * t.perKm + (durationS / 60) * t.perMin;
  return Math.round(Math.max(t.minFare, raw) * surge);
}

export function estimateAll(distanceM, durationS, surge = 1) {
  return Object.values(TIERS).map((t) => ({
    ...t,
    fare: fareFor(t.key, distanceM, durationS, surge),
    surge,
    etaMin: Math.max(1, Math.round(durationS / 60)),
  }));
}
