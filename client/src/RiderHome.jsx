import React, { useEffect, useMemo, useRef, useState } from 'react';
import MapView from './MapView.jsx';
import { api, geocode, reverseGeocode, fmtMoney, fmtKm, fmtMin } from './api.js';
import { getSocket } from './socket.js';
import ThemeToggle from './ThemeToggle.jsx';

const DEFAULT_CENTER = [6.5244, 3.3792]; // Lagos fallback

const STATUS_TEXT = {
  matching: ['Finding your driver…', 'Contacting nearby drivers'],
  accepted: ['Driver is on the way', 'They’ll be at your pickup shortly'],
  arrived: ['Your driver has arrived', 'Meet them at the pickup point'],
  in_progress: ['On your trip', 'Sit back and enjoy the ride'],
};

export default function RiderHome({ user, theme, onToggleTheme }) {
  const [phase, setPhase] = useState('set'); // set | choose | matching | active | rate
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [activeField, setActiveField] = useState('drop');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [tier, setTier] = useState('muvex');
  const [payments, setPayments] = useState([]);
  const [payment, setPayment] = useState('Cash');
  const [ride, setRide] = useState(null);
  const [carPos, setCarPos] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [stars, setStars] = useState(5);
  const [tip, setTip] = useState(0);
  const [toast, setToast] = useState('');
  const [fitKey, setFitKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  // Boot: geolocate, resume active ride, load payment methods
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCenter([lat, lng]);
        // Center map on user but don't auto-fill the pickup field —
        // user picks their pickup explicitly via search or map tap
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
    api('/api/rides/current').then(({ ride: r }) => {
      if (r) {
        setRide(r);
        setPickup(r.pickup); setDrop(r.drop);
        setPhase(r.status === 'matching' || r.status === 'requested' ? 'matching' : 'active');
        if (r.driverLocation) setCarPos(r.driverLocation);
        setFitKey((k) => k + 1);
      }
    }).catch(() => {});
    api('/api/payments').then((d) => setPayments(d.methods)).catch(() => {});
  }, []);

  // Socket: ride updates + live driver location
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onUpdate = (r) => {
      setRide(r);
      if (r.status === 'accepted') { setPhase('active'); setFitKey((k) => k + 1); }
      else if (r.status === 'arrived' || r.status === 'in_progress') setPhase('active');
      else if (r.status === 'completed') { setPhase('rate'); setCarPos(null); }
      else if (r.status === 'cancelled') {
        setPhase('set'); setRide(null); setCarPos(null); setEstimate(null);
        showToast(r.cancelledBy === 'system' ? 'No drivers available right now' : 'Ride cancelled');
      }
    };
    const onLoc = (loc) => setCarPos(loc);
    s.on('ride:update', onUpdate);
    s.on('driver:location', onLoc);
    return () => { s.off('ride:update', onUpdate); s.off('driver:location', onLoc); };
  }, []);

  // Nearby cars while browsing
  useEffect(() => {
    if (phase !== 'set' && phase !== 'choose') { setNearby([]); return; }
    const anchor = pickup || { lat: center[0], lng: center[1] };
    let stop = false;
    const load = () => api(`/api/drivers/nearby?lat=${anchor.lat}&lng=${anchor.lng}`)
      .then((d) => !stop && setNearby(d.drivers)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [phase, pickup?.lat, pickup?.lng]);

  // Address search (debounced)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSuggestions(await geocode(query, pickup || { lat: center[0], lng: center[1] }));
    }, 450);
  }, [query]);

  const setLocation = async (field, loc) => {
    const withAddr = loc.addr ? loc : { ...loc, addr: await reverseGeocode(loc.lat, loc.lng) };
    if (field === 'pickup') setPickup(withAddr); else setDrop(withAddr);
    setQuery(''); setSuggestions([]);
  };

  // Get estimate when both endpoints set
  useEffect(() => {
    if (!pickup || !drop || phase !== 'set') return;
    setBusy(true);
    api('/api/rides/estimate', { method: 'POST', body: { pickup, drop } })
      .then((est) => { setEstimate(est); setPhase('choose'); setFitKey((k) => k + 1); })
      .catch((e) => showToast(e.message))
      .finally(() => setBusy(false));
  }, [pickup, drop]);

  const requestRide = async () => {
    setBusy(true);
    try {
      const { ride: r } = await api('/api/rides', {
        method: 'POST',
        body: { pickup, drop, tier, paymentMethod: payment },
      });
      setRide(r);
      setPhase('matching');
    } catch (e) { showToast(e.message); }
    finally { setBusy(false); }
  };

  const cancelRide = async () => {
    if (!ride) return;
    try {
      await api(`/api/rides/${ride.id}/cancel`, { method: 'POST' });
      setPhase('set'); setRide(null); setCarPos(null); setEstimate(null); setDrop(null);
    } catch (e) { showToast(e.message); }
  };

  const submitRating = async () => {
    try { await api(`/api/rides/${ride.id}/rate`, { method: 'POST', body: { rating: stars, tip } }); }
    catch { /* already rated / non-fatal */ }
    setPhase('set'); setRide(null); setDrop(null); setEstimate(null); setStars(5); setTip(0);
    showToast('Thanks for riding with muve!');
  };

  // Map layers
  const markers = useMemo(() => {
    const list = [];
    if (pickup) list.push({ id: 'pickup', kind: 'pickup', ...pickup });
    if (drop) list.push({ id: 'drop', kind: 'drop', ...drop });
    if (carPos && (phase === 'active' || phase === 'matching')) {
      list.push({ id: 'ridecar', kind: 'car', tracked: true, ...carPos });
    }
    if (phase === 'set' || phase === 'choose') {
      nearby.forEach((d) => list.push({ id: `n${d.id}`, kind: 'car', ...d }));
    }
    return list;
  }, [pickup, drop, carPos, nearby, phase]);

  const route = phase === 'choose' ? estimate?.route : (phase === 'active' || phase === 'matching') ? ride?.route : null;
  const selectedTier = estimate?.tiers?.find((t) => t.key === tier);
  const [sTitle, sSub] = STATUS_TEXT[ride?.status] || ['', ''];

  return (
    <>
      <MapView
        center={center}
        markers={markers}
        route={route}
        fitKey={fitKey}
        theme={theme}
        onMapClick={(phase === 'set' || phase === 'choose') ? (ll) => setLocation(activeField, ll) : null}
      />
      <div className="topbar">
        <div className="brand-chip">muve</div>
        <div className="topbar-right">
          {estimate && phase === 'choose' && <div className="chip">{fmtKm(estimate.distanceM)} · {fmtMin(estimate.durationS)}</div>}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div className="sheet">
        <div className="sheet-grab" />

        {(phase === 'set' || phase === 'choose') && (
          <>
            <h3 className="sheet-title">Where to, {user.name.split(' ')[0]}?</h3>
            <div className={`loc-input ${activeField === 'pickup' ? 'active' : ''}`} onClick={() => setActiveField('pickup')}>
              <span className="dot green" />
              <input
                placeholder="Where from?"
                value={activeField === 'pickup' && query ? query : (pickup?.addr || '')}
                onChange={(e) => { setActiveField('pickup'); setQuery(e.target.value); }}
                onFocus={() => setActiveField('pickup')}
              />
            </div>
            <div className={`loc-input ${activeField === 'drop' ? 'active' : ''}`} onClick={() => setActiveField('drop')}>
              <span className="dot red" />
              <input
                placeholder="Where to?"
                value={activeField === 'drop' && query ? query : (drop?.addr || '')}
                onChange={(e) => { setActiveField('drop'); setQuery(e.target.value); }}
                onFocus={() => setActiveField('drop')}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((sug, i) => (
                  <button key={i} onClick={() => setLocation(activeField, sug)}>📍 {sug.addr}</button>
                ))}
              </div>
            )}
            <div className="hint">Search above or tap the map to set your {activeField === 'pickup' ? 'pickup' : 'destination'}</div>

            {phase === 'choose' && estimate && (
              <div style={{ marginTop: 12 }}>
                {estimate.tiers.map((t) => (
                  <button key={t.key} className={`tier ${tier === t.key ? 'active' : ''}`} onClick={() => setTier(t.key)}>
                    <span className="t-icon">{t.icon}</span>
                    <span>
                      <div className="t-name">{t.name} <span className="muted">· {t.seats} seats</span>
                        {t.surge > 1 && <span className="surge-tag">{t.surge}x surge</span>}
                      </div>
                      <div className="t-sub">{t.blurb}</div>
                    </span>
                    <span className="t-fare">{fmtMoney(t.fare)}</span>
                  </button>
                ))}
                <div className="row spread" style={{ margin: '10px 0 12px' }}>
                  <span className="muted">Payment</span>
                  <select value={payment} onChange={(e) => setPayment(e.target.value)}
                    style={{ border: '1.5px solid var(--line)', borderRadius: 8, padding: '6px 10px', background: 'var(--surface)', color: 'var(--ink)' }}>
                    {payments.map((p) => (
                      <option key={p.id} value={p.label || p.brand}>{p.label || `${p.brand} •••• ${p.last4}`}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-dark btn-block" onClick={requestRide} disabled={busy}>
                  {busy ? 'Requesting…' : `Request ${selectedTier?.name} · ${fmtMoney(selectedTier?.fare)}`}
                </button>
                <div className="hint">{estimate.nearbyDrivers} drivers nearby</div>
              </div>
            )}
            {busy && phase === 'set' && <div className="row" style={{ justifyContent: 'center', padding: 10 }}><div className="spinner" /></div>}
          </>
        )}

        {phase === 'matching' && (
          <div className="status-banner">
            <div className="row" style={{ justifyContent: 'center', marginBottom: 10 }}><div className="spinner" /></div>
            <div className="s-title">Finding your driver…</div>
            <div className="s-sub">Contacting nearby {ride?.tier === 'black' ? 'Muve Black' : ride?.tier === 'muvexl' ? 'MuveXL' : 'MuveX'} drivers</div>
            <button className="btn btn-light btn-block" style={{ marginTop: 16 }} onClick={cancelRide}>Cancel request</button>
          </div>
        )}

        {phase === 'active' && ride && (
          <>
            <div className="status-banner">
              <div className="s-title"><span className="pulse" />{sTitle}</div>
              <div className="s-sub">{sSub}</div>
            </div>
            {ride.driver && (
              <div className="driver-card">
                <div className="avatar">{ride.driver.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{ride.driver.name} <span className="muted">★ {ride.driver.rating}</span></div>
                  <div className="muted">{ride.driver.vehicle?.color} {ride.driver.vehicle?.make} {ride.driver.vehicle?.model}</div>
                </div>
                <div className="plate">{ride.driver.vehicle?.plate}</div>
              </div>
            )}
            <div className="row spread" style={{ marginBottom: 12 }}>
              <span className="muted">{fmtKm(ride.distanceM)} · {fmtMin(ride.durationS)} · {ride.paymentMethod}</span>
              <span className="big">{fmtMoney(ride.fare)}</span>
            </div>
            {['accepted', 'arrived'].includes(ride.status) && (
              <button className="btn btn-light btn-block" onClick={cancelRide}>Cancel ride (₦200 fee)</button>
            )}
          </>
        )}

        {phase === 'rate' && ride && (
          <div style={{ textAlign: 'center' }}>
            <div className="s-title" style={{ fontSize: 20, fontWeight: 800 }}>You’ve arrived 🎉</div>
            <div className="muted" style={{ margin: '6px 0 4px' }}>Total charged to {ride.paymentMethod}</div>
            <div className="big" style={{ fontSize: 32 }}>{fmtMoney(ride.fare + tip)}</div>
            <div className="muted" style={{ marginTop: 14 }}>Rate {ride.driver?.name?.split(' ')[0] || 'your driver'}</div>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>
              ))}
            </div>
            <div className="tip-row">
              {[0, 1, 2, 5].map((t) => (
                <button key={t} className={`tip-btn ${tip === t ? 'active' : ''}`} onClick={() => setTip(t)}>
                  {t === 0 ? 'No tip' : fmtMoney(t)}
                </button>
              ))}
            </div>
            <button className="btn btn-dark btn-block" onClick={submitRating}>Done</button>
          </div>
        )}
      </div>
    </>
  );
}
