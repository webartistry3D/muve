// Imperative Leaflet wrapper. Markers: {id, lat, lng, kind: 'pickup'|'drop'|'car'|'me', heading?}
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

const icons = {
  pickup: () => L.divIcon({ className: '', html: '<div class="pin green"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
  drop: () => L.divIcon({ className: '', html: '<div class="pin red"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
  me: () => L.divIcon({ className: '', html: '<div class="pin" style="background:#1a73e8"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
  car: (heading = 0) => L.divIcon({
    className: '',
    html: `<div class="car-marker" style="transform:rotate(${Math.round(heading)}deg)">🚘</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13],
  }),
};

export default function MapView({ center, markers = [], route = null, fitKey = null, onMapClick, theme = 'light' }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const layerRef = useRef({ markers: new Map(), route: null });
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: false })
      .setView(center || [19.076, 72.8777], 14);
    tileRef.current = L.tileLayer(TILES[theme] || TILES.light, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false })
      .addAttribution('© OpenStreetMap © CARTO').addTo(map);
    map.on('click', (e) => clickRef.current && clickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    return () => map.remove();
  }, []);

  // Swap tile layer when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    const oldTile = tileRef.current;
    tileRef.current = L.tileLayer(TILES[theme] || TILES.light, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    map.removeLayer(oldTile);
  }, [theme]);

  // Recenter when center prop changes meaningfully
  useEffect(() => {
    if (mapRef.current && center) mapRef.current.setView(center, mapRef.current.getZoom());
  }, [center?.[0], center?.[1]]);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = layerRef.current.markers;
    const seen = new Set();
    for (const m of markers) {
      seen.add(m.id);
      const cur = existing.get(m.id);
      if (cur) {
        cur.setLatLng([m.lat, m.lng]);
        if (m.kind === 'car') cur.setIcon(icons.car(m.heading));
      } else {
        const icon = m.kind === 'car' ? icons.car(m.heading) : icons[m.kind]();
        existing.set(m.id, L.marker([m.lat, m.lng], { icon, interactive: false }).addTo(map));
      }
    }
    for (const [id, marker] of existing) {
      if (!seen.has(id)) { marker.remove(); existing.delete(id); }
    }
  }, [markers]);

  // Sync route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current.route) { layerRef.current.route.remove(); layerRef.current.route = null; }
    if (route && route.length > 1) {
      const routeColor = theme === 'dark' ? '#f5f5f8' : '#0b0b0b';
      layerRef.current.route = L.polyline(route, { color: routeColor, weight: 4, opacity: 0.85 }).addTo(map);
    }
  }, [route, theme]);

  // Fit bounds when fitKey changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey == null) return;
    const pts = [];
    if (route) pts.push(...route);
    markers.filter((m) => m.kind !== 'car' || m.tracked).forEach((m) => pts.push([m.lat, m.lng]));
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16 });
    else if (pts.length === 1) map.setView(pts[0], 15);
  }, [fitKey]);

  return <div ref={elRef} className="map-full" />;
}
