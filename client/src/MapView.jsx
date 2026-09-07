// Mapbox GL vector map wrapper. Markers: {id, lat, lng, kind: 'pickup'|'drop'|'car'|'me', heading?}
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import Icon from './Icons.jsx';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
mapboxgl.accessToken = TOKEN;

const STYLES = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

// Custom HTML markers for each kind
const SEDAN_SVG = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="9" y="3" width="10" height="22" rx="5" fill="#1a1a1f" stroke="#fff" stroke-width="1.5"/>
  <rect x="11" y="6" width="6" height="5" rx="1.5" fill="#cfe8ff" opacity="0.85"/>
  <rect x="11" y="17" width="6" height="4" rx="1.5" fill="#cfe8ff" opacity="0.6"/>
  <rect x="6" y="9" width="3" height="3" rx="1" fill="#1a1a1f" stroke="#fff" stroke-width="0.8"/>
  <rect x="19" y="9" width="3" height="3" rx="1" fill="#1a1a1f" stroke="#fff" stroke-width="0.8"/>
  <rect x="6" y="16" width="3" height="3" rx="1" fill="#1a1a1f" stroke="#fff" stroke-width="0.8"/>
  <rect x="19" y="16" width="3" height="3" rx="1" fill="#1a1a1f" stroke="#fff" stroke-width="0.8"/>
</svg>`;

function markerEl(kind, heading = 0) {
  const el = document.createElement('div');
  el.className = 'mapbox-marker';
  if (kind === 'pickup') el.innerHTML = '<div class="pin green"></div>';
  else if (kind === 'drop') el.innerHTML = '<div class="pin red"></div>';
  else if (kind === 'me') el.innerHTML = '<div class="pin" style="background:#1a73e8"></div>';
  else if (kind === 'car') el.innerHTML = `<div class="car-marker" style="transform:rotate(${Math.round(heading)}deg)">${SEDAN_SVG}</div>`;
  return el;
}

export default function MapView({ center, markers = [], route = null, fitKey = null, onMapClick, theme = 'light' }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(new Map());
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const [satellite, setSatellite] = useState(false);

  // Init map
  useEffect(() => {
    if (!TOKEN) {
      if (elRef.current) elRef.current.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--sub);font-size:13px;padding:20px;text-align:center">Set VITE_MAPBOX_TOKEN to load the map</div>';
      return;
    }
    const map = new mapboxgl.Map({
      container: elRef.current,
      style: STYLES[theme] || STYLES.light,
      center: center ? [center[1], center[0]] : [3.3792, 6.5244],
      zoom: 14,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('click', (e) => clickRef.current && clickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Swap style when theme or satellite changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const styleKey = satellite ? 'satellite' : theme;
    map.setStyle(STYLES[styleKey] || STYLES.light);
    // Re-add route layer after style loads
    map.once('style.load', () => {
      if (route && route.length > 1) addRouteLayer(map, route, theme);
    });
  }, [theme, satellite]);

  // Recenter when center prop changes
  useEffect(() => {
    if (mapRef.current && center) mapRef.current.flyTo({ center: [center[1], center[0]], duration: 500 });
  }, [center?.[0], center?.[1]]);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markerRef.current;
    const seen = new Set();
    for (const m of markers) {
      seen.add(m.id);
      const cur = existing.get(m.id);
      if (cur) {
        cur.setLngLat([m.lng, m.lat]);
        if (m.kind === 'car') {
          const el = cur.getElement();
          el.innerHTML = `<div class="car-marker" style="transform:rotate(${Math.round(m.heading || 0)}deg)">${SEDAN_SVG}</div>`;
        }
      } else {
        const el = markerEl(m.kind, m.heading);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        existing.set(m.id, marker);
      }
    }
    for (const [id, marker] of existing) {
      if (!seen.has(id)) { marker.remove(); existing.delete(id); }
    }
  }, [markers]);

  // Sync route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    removeRouteLayer(map);
    if (route && route.length > 1) addRouteLayer(map, route, theme);
  }, [route, theme]);

  // Fit bounds when fitKey changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey == null) return;
    const pts = [];
    if (route) pts.push(...route.map(([lat, lng]) => [lng, lat]));
    markers.filter((m) => m.kind !== 'car' || m.tracked).forEach((m) => pts.push([m.lng, m.lat]));
    if (pts.length > 1) {
      const bounds = pts.reduce((b, p) => b.extend(p), new mapboxgl.LngLatBounds(pts[0], pts[0]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
    } else if (pts.length === 1) {
      map.flyTo({ center: pts[0], zoom: 15, duration: 800 });
    }
  }, [fitKey]);

  return (
    <div className="map-wrap">
      <div ref={elRef} className="map-full" />
      <button className="sat-toggle" onClick={() => setSatellite(!satellite)} title={satellite ? 'Street view' : 'Satellite view'}>
        <Icon name={satellite ? 'globe' : 'pin'} size={20} />
      </button>
    </div>
  );
}

function addRouteLayer(map, route, theme) {
  const geojson = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: route.map(([lat, lng]) => [lng, lat]),
    },
  };
  const routeColor = theme === 'dark' ? '#f5f5f8' : '#0b0b0b';
  map.addSource('route', { type: 'geojson', data: geojson });
  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': routeColor, 'line-width': 4, 'line-opacity': 0.85 },
  });
}

function removeRouteLayer(map) {
  if (map.getLayer('route')) map.removeLayer('route');
  if (map.getSource('route')) map.removeSource('route');
}
