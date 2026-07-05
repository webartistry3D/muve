// Fare engine: tiers, haversine distance, surge pricing, estimates.

export const TIERS = {
  zberx:  { key: 'zberx',  name: 'ZberX',     seats: 4, base: 1.5, perKm: 1.1, perMin: 0.25, minFare: 5,  icon: '🚗', blurb: 'Affordable, everyday rides' },
  zberxl: { key: 'zberxl', name: 'ZberXL',    seats: 6, base: 2.5, perKm: 1.8, perMin: 0.35, minFare: 8,  icon: '🚙', blurb: 'Extra room for groups' },
  black:  { key: 'black',  name: 'Zber Black', seats: 4, base: 5.0, perKm: 2.5, perMin: 0.5,  minFare: 12, icon: '🏴', blurb: 'Premium rides, top drivers' },
};

export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function computeSurge({ activeRides, idleDrivers }) {
  const s = 1 + 0.15 * activeRides - 0.05 * idleDrivers;
  return Math.min(2, Math.max(1, Math.round(s * 20) / 20));
}

export function fareFor(tierKey, distanceM, durationS, surge = 1) {
  const t = TIERS[tierKey];
  const raw = t.base + (distanceM / 1000) * t.perKm + (durationS / 60) * t.perMin;
  return Math.round(Math.max(t.minFare, raw) * surge * 100) / 100;
}

export function estimateAll(distanceM, durationS, surge = 1) {
  return Object.values(TIERS).map((t) => ({
    ...t,
    fare: fareFor(t.key, distanceM, durationS, surge),
    surge,
    etaMin: Math.max(1, Math.round(durationS / 60)),
  }));
}
