// Minimal API client with JWT auth.
// In dev, Vite proxies /api to localhost:4000. In prod, VITE_API_URL points to the backend.
const API_BASE = import.meta.env.VITE_API_URL || '';
export function getToken() { return localStorage.getItem('muve_token'); }
export function setSession(token, user) {
  localStorage.setItem('muve_token', token);
  localStorage.setItem('muve_user', JSON.stringify(user));
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem('muve_user')); } catch { return null; }
}
export function clearSession() {
  localStorage.removeItem('muve_token');
  localStorage.removeItem('muve_user');
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Geocoding via Mapbox (with Nominatim fallback)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export async function geocode(q, near) {
  try {
    if (MAPBOX_TOKEN) {
      const proximity = near ? `&proximity=${near.lng},${near.lat}` : '';
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=5&country=ng${proximity}`);
      if (res.ok) {
        const data = await res.json();
        return data.features.map((f) => ({ lat: f.center[1], lng: f.center[0], addr: f.place_name }));
      }
    }
    // Fallback to Nominatim
    const params = new URLSearchParams({ format: 'json', q, limit: '5' });
    if (near) params.set('viewbox', `${near.lng - 0.3},${near.lat + 0.3},${near.lng + 0.3},${near.lat - 0.3}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r) => ({ lat: +r.lat, lng: +r.lon, addr: r.display_name }));
  } catch { return []; }
}

export async function reverseGeocode(lat, lng) {
  try {
    if (MAPBOX_TOKEN) {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,place`);
      if (res.ok) {
        const data = await res.json();
        if (data.features?.[0]) return data.features[0].place_name;
      }
    }
    // Fallback to Nominatim
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export const fmtMoney = (n) => `\u20a6${(Number(n) || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
export const fmtKm = (m) => `${((m || 0) / 1000).toFixed(1)} km`;
export const fmtMin = (s) => `${Math.max(1, Math.round((s || 0) / 60))} min`;
