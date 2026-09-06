// Road routing via Mapbox Directions API, with straight-line fallback
// so the app still works offline.
import { haversineM } from './fares.js';

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || '';

export async function getRoute(fromLat, fromLng, toLat, toLng) {
  try {
    if (MAPBOX_TOKEN) {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&access_token=${MAPBOX_TOKEN}`;
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
            // GeoJSON is [lng,lat]; flip to [lat,lng] for the frontend
            points: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          };
        }
      }
    }

    // Fallback to OSRM if no Mapbox token
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
