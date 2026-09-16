// Mapbox GL vector map wrapper. Markers: {id, lat, lng, kind: 'pickup'|'drop'|'car'|'me', heading?}
// Uses Mapbox Standard styles only:
//   - Light/dark via `standard` style + `lightPreset` config (no style swap, preserves route layer)
//   - Satellite via `standard-satellite` style
//   - 3D + label/road toggles via Standard config properties
//   - All map options live in a slide-up settings panel (gear button)
//   - Car markers rendered as 3D GLB model via deck.gl ScenegraphLayer
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { DracoLoader } from '@loaders.gl/draco';
import Icon from './Icons.jsx';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
mapboxgl.accessToken = TOKEN;

const CAR_MODEL_URL = '/assets/MuveX.glb';
const MODEL_HEADING_OFFSET = 0; // Adjust if model faces wrong direction (0, 90, 180, 270)
const CAR_SIZE_SCALE = 15; // Model size multiplier on map

const STYLES = {
  standard: 'mapbox://styles/mapbox/standard',
  satellite: 'mapbox://styles/mapbox/standard-satellite',
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

// Default map settings state
const DEFAULT_SETTINGS = {
  lightPreset: null, // null = follow theme (day/night)
  satellite: false,
  show3dObjects: true,
  show3dBuildings: true,
  show3dTrees: true,
  show3dLandmarks: true,
  showPedestrianRoads: true,
  showPlaceLabels: true,
  showPointOfInterestLabels: true,
  showRoadLabels: true,
  showTransitLabels: true,
};

// Config properties that can be toggled at runtime via setConfigProperty (no style swap)
const CONFIG_TOGGLES = [
  'show3dObjects',
  'show3dBuildings',
  'show3dTrees',
  'show3dLandmarks',
  'showPedestrianRoads',
  'showPlaceLabels',
  'showPointOfInterestLabels',
  'showRoadLabels',
  'showTransitLabels',
];

// Build the Standard style config object from settings + theme
function buildConfig(theme, settings) {
  const basemap = { lightPreset: settings.lightPreset || (theme === 'dark' ? 'night' : 'day') };
  for (const key of CONFIG_TOGGLES) basemap[key] = settings[key];
  return { basemap };
}

const LIGHT_PRESETS = [
  { value: 'day', label: 'Day' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'dawn', label: 'Dawn' },
  { value: 'night', label: 'Night' },
];

// Settings panel toggle rows definition
const TOGGLE_ROWS = [
  { group: 'View' },
  { key: 'satellite', label: 'Satellite', icon: 'globe', type: 'style' },
  { key: 'show3dObjects', label: '3D Objects', icon: 'box', type: 'config' },
  { group: '3D Details' },
  { key: 'show3dBuildings', label: '3D Buildings', type: 'config' },
  { key: 'show3dTrees', label: '3D Trees', type: 'config' },
  { key: 'show3dLandmarks', label: '3D Landmarks', type: 'config' },
  { group: 'Labels' },
  { key: 'showPlaceLabels', label: 'Place Labels', type: 'config' },
  { key: 'showPointOfInterestLabels', label: 'POI Labels', type: 'config' },
  { key: 'showRoadLabels', label: 'Road Labels', type: 'config' },
  { key: 'showTransitLabels', label: 'Transit Labels', type: 'config' },
  { group: 'Roads' },
  { key: 'showPedestrianRoads', label: 'Pedestrian Roads', type: 'config' },
];

export default function MapView({ center, markers = [], route = null, fitKey = null, onMapClick, theme = 'light' }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(new Map());
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [panelOpen, setPanelOpen] = useState(false);
  const deckOverlayRef = useRef(null);
  const scenegraphRef = useRef(null);

  // Keep latest state accessible to style-load handler without re-init
  const stateRef = useRef({ theme, settings });
  stateRef.current = { theme, settings };

  // Init map
  useEffect(() => {
    if (!TOKEN) {
      if (elRef.current) elRef.current.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--sub);font-size:13px;padding:20px;text-align:center">Set VITE_MAPBOX_TOKEN to load the map</div>';
      return;
    }
    const map = new mapboxgl.Map({
      container: elRef.current,
      style: STYLES.standard,
      config: buildConfig(theme, DEFAULT_SETTINGS),
      center: center ? [center[1], center[0]] : [3.3792, 6.5244],
      zoom: 14,
      pitch: 45,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('click', (e) => clickRef.current && clickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    map.on('style.load', () => {
      if (route && route.length > 1) addRouteLayer(map, route, theme);
    });

    // Add deck.gl overlay for 3D car markers
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);
    deckOverlayRef.current = overlay;

    // Load GLB model
    load(CAR_MODEL_URL, [GLTFLoader, DracoLoader])
      .then((gltf) => { scenegraphRef.current = gltf; })
      .catch((err) => console.error('Failed to load car model:', err));

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; deckOverlayRef.current = null; };
  }, []);

  // Theme change: update lightPreset in-place (unless user manually picked one)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const preset = settings.lightPreset || (theme === 'dark' ? 'night' : 'day');
    map.setConfigProperty('basemap', 'lightPreset', preset);
  }, [theme, settings.lightPreset]);

  // Config toggle changes: apply via setConfigProperty (no style swap needed)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const key of CONFIG_TOGGLES) {
      map.setConfigProperty('basemap', key, settings[key]);
    }
    // 3D pitch follows show3dObjects
    map.easeTo({ pitch: settings.show3dObjects ? 45 : 0, duration: 600 });
  }, [settings.show3dObjects, settings.show3dBuildings, settings.show3dTrees, settings.show3dLandmarks, settings.showPedestrianRoads, settings.showPlaceLabels, settings.showPointOfInterestLabels, settings.showRoadLabels, settings.showTransitLabels]);

  // Satellite toggle: swap style between standard and standard-satellite
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const styleKey = settings.satellite ? 'satellite' : 'standard';
    map.setStyle(STYLES[styleKey], { config: buildConfig(stateRef.current.theme, stateRef.current.settings) });
    map.once('style.load', () => {
      if (route && route.length > 1) addRouteLayer(map, route, stateRef.current.theme);
    });
  }, [settings.satellite]);

  // Recenter when center prop changes
  useEffect(() => {
    if (mapRef.current && center) mapRef.current.flyTo({ center: [center[1], center[0]], duration: 500 });
  }, [center?.[0], center?.[1]]);

  // Sync markers — car markers go to deck.gl 3D layer, others stay as HTML markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markerRef.current;
    const seen = new Set();

    // Non-car markers: HTML markers (pickup, drop, me)
    for (const m of markers) {
      if (m.kind === 'car') continue; // cars handled by deck.gl
      seen.add(m.id);
      const cur = existing.get(m.id);
      if (cur) {
        cur.setLngLat([m.lng, m.lat]);
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

    // Car markers: deck.gl ScenegraphLayer
    const carMarkers = markers.filter((m) => m.kind === 'car');
    if (deckOverlayRef.current) {
      deckOverlayRef.current.setProps({
        layers: [
          new ScenegraphLayer({
            id: 'car-3d',
            data: carMarkers,
            scenegraph: scenegraphRef.current || CAR_MODEL_URL,
            getPosition: (d) => [d.lng, d.lat, 0],
            getOrientation: (d) => [0, MODEL_HEADING_OFFSET + (d.heading || 0), 0],
            sizeScale: CAR_SIZE_SCALE,
            sizeMinPixels: 20,
            sizeMaxPixels: 200,
            pickable: false,
            _subLayerProps: {
              scenegraph: { color: [0.8, 0.8, 0.85] },
            },
          }),
        ],
      });
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

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="map-wrap">
      <div ref={elRef} className="map-full" />
      <button
        className="map-settings-btn"
        onClick={() => setPanelOpen(true)}
        title="Map settings"
      >
        <Icon name="gear" size={20} />
      </button>

      <div className={`map-panel-overlay ${panelOpen ? 'open' : ''}`} onClick={() => setPanelOpen(false)} />
      <div className={`map-panel ${panelOpen ? 'open' : ''}`}>
        <div className="map-panel-header">
          <span className="map-panel-title">Map Settings</span>
          <button className="map-panel-close" onClick={() => setPanelOpen(false)}>×</button>
        </div>
        <div className="map-panel-body">
          <div className="map-panel-group">Time of Day</div>
          <div className="map-time-row">
            {LIGHT_PRESETS.map((p) => (
              <button
                key={p.value}
                className={`map-time-btn ${(settings.lightPreset || (theme === 'dark' ? 'night' : 'day')) === p.value ? 'active' : ''}`}
                onClick={() => setSettings((prev) => ({ ...prev, lightPreset: p.value }))}
              >
                {p.label}
              </button>
            ))}
            <button
              className={`map-time-btn ${!settings.lightPreset ? 'active' : ''}`}
              onClick={() => setSettings((prev) => ({ ...prev, lightPreset: null }))}
            >
              Auto
            </button>
          </div>
          {TOGGLE_ROWS.map((row, i) => {
            if (row.group) return <div key={i} className="map-panel-group">{row.group}</div>;
            return (
              <button
                key={row.key}
                className={`map-panel-row ${settings[row.key] ? 'on' : 'off'}`}
                onClick={() => toggleSetting(row.key)}
              >
                <span className="map-panel-row-left">
                  {row.icon && <Icon name={row.icon} size={18} />}
                  <span className="map-panel-row-label">{row.label}</span>
                </span>
                <span className={`map-switch ${settings[row.key] ? 'on' : ''}`}>
                  <span className="map-switch-knob" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
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
    slot: 'middle',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': routeColor, 'line-width': 4, 'line-opacity': 0.85 },
  });
}

function removeRouteLayer(map) {
  if (map.getLayer('route')) map.removeLayer('route');
  if (map.getSource('route')) map.removeSource('route');
}
