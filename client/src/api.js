// Minimal API client with JWT auth.
export function getToken() { return localStorage.getItem('zber_token'); }
export function setSession(token, user) {
  localStorage.setItem('zber_token', token);
  localStorage.setItem('zber_user', JSON.stringify(user));
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem('zber_user')); } catch { return null; }
}
export function clearSession() {
  localStorage.removeItem('zber_token');
  localStorage.removeItem('zber_user');
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
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

// Geocoding via OpenStreetMap Nominatim (free, no key)
export async function geocode(q, near) {
  const params = new URLSearchParams({ format: 'json', q, limit: '5' });
  if (near) params.set('viewbox', `${near.lng - 0.3},${near.lat + 0.3},${near.lng + 0.3},${near.lat - 0.3}`);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((r) => ({ lat: +r.lat, lng: +r.lon, addr: r.display_name }));
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
export const fmtKm = (m) => `${((m || 0) / 1000).toFixed(1)} km`;
export const fmtMin = (s) => `${Math.max(1, Math.round((s || 0) / 60))} min`;
