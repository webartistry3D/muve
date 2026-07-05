// Road routing via the public OSRM demo server, with straight-line fallback
// so the app still works offline.
import { haversineM } from './fares.js';

export async function getRoute(fromLat, fromLng, toLat, toLng) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const r = data.routes?.[0];
      if (r) {
        return {
          distanceM: r.distance,
          durationS: r.duration,
          // GeoJSON is [lng,lat]; flip to [lat,lng] for Leaflet + sim engine
          points: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        };
      }
    }
  } catch { /* fall through to straight line */ }

  const distanceM = haversineM(fromLat, fromLng, toLat, toLng) * 1.3; // road factor
  const durationS = (distanceM / 1000 / 32) * 3600; // ~32 km/h city speed
  const points = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    points.push([fromLat + ((toLat - fromLat) * i) / steps, fromLng + ((toLng - fromLng) * i) / steps]);
  }
  return { distanceM, durationS, points };
}
