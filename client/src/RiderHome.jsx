import React, { useEffect, useMemo, useRef, useState } from 'react';
import MapView from './MapView.jsx';
import { api, geocode, reverseGeocode, fmtMoney, fmtKm, fmtMin, listPlaces, savePlace, deletePlace } from './api.js';
import { getSocket } from './socket.js';
import ThemeToggle from './ThemeToggle.jsx';
import Icon from './Icons.jsx';

const DEFAULT_CENTER = [6.5244, 3.3792]; // Lagos fallback

const STATUS_TEXT = {
  matching: ['Finding your driver…', 'Contacting nearby drivers'],
  accepted: ['Driver is on the way', 'They’ll be at your pickup shortly'],
  arrived: ['Your driver has arrived', 'Meet them at the pickup point'],
  in_progress: ['On your trip', 'Sit back and enjoy the ride'],
};

export default function RiderHome({ user, theme, onToggleTheme, paymentVersion = 0 }) {
  const [phase, setPhase] = useState('set'); // set | choose | matching | active | rate | counter
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [activeField, setActiveField] = useState('drop');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [proposedFare, setProposedFare] = useState(null);
  const [useCustomFare, setUseCustomFare] = useState(false);
  const [tier, setTier] = useState('muvex');
  const [tierOpen, setTierOpen] = useState(false);
  const [ride, setRide] = useState(null);
  const [carPos, setCarPos] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [stars, setStars] = useState(5);
  const [tip, setTip] = useState(0);
  const [paying, setPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // null | 'pending' | 'paid' | 'failed'
  const [payError, setPayError] = useState('');
  const [unpaidTrips, setUnpaidTrips] = useState([]);
  const [payingUnpaid, setPayingUnpaid] = useState(null); // tripId being paid
  const [toast, setToast] = useState('');
  const [fitKey, setFitKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [places, setPlaces] = useState([]);
  const [savingPlace, setSavingPlace] = useState(false); // 'pickup' | 'drop' | null
  const [placeLabel, setPlaceLabel] = useState('');
  const debounceRef = useRef(null);

  // Sheet is only hideable in the initial 'set' / 'choose' phases.
  // For matching / counter / active / rate it stays visible.
  const sheetHidden = (phase === 'set' || phase === 'choose') && !sheetOpen;

  const closeSheet = () => {
    if (phase === 'choose') {
      // Reset back to the initial 'set' state
      setDrop(null); setEstimate(null); setProposedFare(null); setUseCustomFare(false); setPhase('set');
    }
    setSheetOpen(false);
  };

  // Load saved places on mount
  useEffect(() => { listPlaces().then(setPlaces).catch(() => {}); }, []);

  const usePlace = (p) => {
    const loc = { lat: p.lat, lng: p.lng, addr: p.addr || p.label };
    setLocation(activeField, loc);
  };

  const confirmSavePlace = async () => {
    const target = savingPlace === 'pickup' ? pickup : savingPlace === 'drop' ? drop : null;
    if (!target) { setSavingPlace(false); return; }
    const label = placeLabel.trim() || target.addr || 'Saved place';
    try {
      const created = await savePlace({ label, lat: target.lat, lng: target.lng, addr: target.addr, type: 'custom' });
      setPlaces((prev) => [...prev, created]);
      showToast('Place saved');
    } catch (e) { showToast(e.message); }
    setSavingPlace(false); setPlaceLabel('');
  };

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
    loadUnpaidTrips();
  }, []);

  const loadUnpaidTrips = () => {
    api('/api/payments/unpaid').then((d) => setUnpaidTrips(d.trips || [])).catch(() => {});
  };

  // Reload unpaid trips when payment status changes (e.g. paid from Account page)
  useEffect(() => { loadUnpaidTrips(); }, [paymentVersion]);

  // Socket: ride updates + live driver location
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onUpdate = (r) => {
      setRide(r);
      if (r.status === 'accepted') { setPhase('active'); setFitKey((k) => k + 1); }
      else if (r.status === 'arrived' || r.status === 'in_progress') setPhase('active');
      else if (r.status === 'completed') { setPhase('rate'); setCarPos(null); checkPaymentStatus(r.id); }
      else if (r.status === 'cancelled') {
        setPhase('set'); setRide(null); setCarPos(null); setEstimate(null);
        setProposedFare(null); setUseCustomFare(false);
        showToast(r.cancelledBy === 'system' ? 'No drivers available right now' : 'Ride cancelled');
      }
      else if (r.status === 'matching' && r.fareStatus === 'countered') {
        setPhase('counter');
      }
      else if (r.status === 'matching' && r.fareStatus === 'agreed' && phase === 'counter') {
        setPhase('matching');
      }
    };
    const onFareRejected = () => {
      showToast('Driver rejected your proposed fare');
    };
    s.on('ride:fare:rejected', onFareRejected);
    const onLoc = (loc) => setCarPos(loc);
    const onPaymentConfirmed = () => { setPaymentStatus('paid'); showToast('Payment confirmed'); setPaying(false); };
    s.on('ride:update', onUpdate);
    s.on('driver:location', onLoc);
    s.on('payment:confirmed', onPaymentConfirmed);
    return () => { s.off('ride:update', onUpdate); s.off('driver:location', onLoc); s.off('ride:fare:rejected', onFareRejected); s.off('payment:confirmed', onPaymentConfirmed); };
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
    setQuery(withAddr.addr || ''); setSuggestions([]);
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
      const body = { pickup, drop, tier };
      if (useCustomFare && proposedFare > 0) body.proposedFare = proposedFare;
      const { ride: r } = await api('/api/rides', {
        method: 'POST',
        body,
      });
      setRide(r);
      setPhase('matching');
    } catch (e) {
      if (e.message.includes('pending payment') || e.message.includes('unpaid')) {
        loadUnpaidTrips();
        showToast('You have an unpaid trip — please pay it first');
      } else {
        showToast(e.message);
      }
    }
    finally { setBusy(false); }
  };

  const acceptCounter = async () => {
    try {
      await api(`/api/rides/${ride.id}/accept-counter`, { method: 'POST' });
      setPhase('matching');
    } catch (e) { showToast(e.message); }
  };

  const declineCounter = async () => {
    try {
      await api(`/api/rides/${ride.id}/decline-counter`, { method: 'POST' });
      setPhase('set'); setRide(null); setCarPos(null); setEstimate(null);
      setProposedFare(null); setUseCustomFare(false);
    } catch (e) { showToast(e.message); }
  };

  const cancelRide = async () => {
    if (!ride) return;
    try {
      await api(`/api/rides/${ride.id}/cancel`, { method: 'POST' });
      setPhase('set'); setRide(null); setCarPos(null); setEstimate(null); setDrop(null);
    } catch (e) { showToast(e.message); }
  };

  const payUnpaidTrip = async (trip) => {
    setPayingUnpaid(trip.id);
    setPayError('');
    try {
      const d = await api('/api/payments/paystack/initialize', { method: 'POST', body: { tripId: trip.id } });
      const payRef = d.reference;
      if (!window.PaystackPop) {
        if (d.authorizationUrl) window.location.href = d.authorizationUrl;
        return;
      }
      const handler = window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: d.amountKobo,
        currency: 'NGN',
        ref: payRef,
        metadata: {
          custom_fields: [
            { display_name: 'Trip ID', variable_name: 'trip_id', value: String(trip.id) },
            { display_name: 'Rider ID', variable_name: 'rider_id', value: String(user.id) },
          ],
        },
        onClose: () => setPayingUnpaid(null),
        callback: () => {
          // Verify the payment
          api('/api/payments/paystack/verify', { method: 'POST', body: { reference: payRef } })
            .then((v) => {
              if (v.status === 'PAID') {
                showToast('Payment confirmed');
                loadUnpaidTrips();
              } else {
                setPayError('Payment could not be verified. Please try again.');
              }
              setPayingUnpaid(null);
            })
            .catch(() => { setPayError('Verification failed'); setPayingUnpaid(null); });
        },
      });
      handler.openIframe();
    } catch (e) {
      setPayError(e.message || 'Payment failed to start');
      setPayingUnpaid(null);
    }
  };

  const checkPaymentStatus = async (tripId) => {
    try {
      const d = await api(`/api/payments/${tripId}/status`);
      setPaymentStatus(d.status);
    } catch { /* no payment record yet */ }
  };

  const initViaBackend = async () => {
    try {
      const d = await api('/api/payments/paystack/initialize', { method: 'POST', body: { tripId: ride.id } });
      setPaymentStatus('pending');
      if (d.authorizationUrl) window.location.href = d.authorizationUrl;
    } catch (e) {
      setPayError(e.message || 'Payment failed to start');
      setPaying(false);
    }
  };

  const startPaystackPayment = async () => {
    setPaying(true);
    setPayError('');
    try {
      const d = await api('/api/payments/paystack/initialize', { method: 'POST', body: { tripId: ride.id, tip } });
      const payRef = d.reference;
      if (!window.PaystackPop) {
        if (d.authorizationUrl) window.location.href = d.authorizationUrl;
        return;
      }
      const handler = window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: d.amountKobo,
        currency: 'NGN',
        ref: payRef,
        metadata: {
          custom_fields: [
            { display_name: 'Trip ID', variable_name: 'trip_id', value: String(ride.id) },
            { display_name: 'Rider ID', variable_name: 'rider_id', value: String(user.id) },
          ],
        },
        onClose: () => setPaying(false),
        callback: () => {
          setPaymentStatus('pending');
          verifyPayment(payRef);
        },
      });
      handler.openIframe();
    } catch (e) {
      setPayError(e.message || 'Payment failed to start');
      setPaying(false);
    }
  };

  const verifyPayment = async (reference) => {
    try {
      const d = await api('/api/payments/paystack/verify', { method: 'POST', body: { reference } });
      if (d.status === 'PAID') {
        setPaymentStatus('paid');
        showToast('Payment confirmed');
        setPaying(false);
      } else {
        setPaymentStatus('failed');
        setPayError('Payment could not be verified. Please try again.');
        setPaying(false);
      }
    } catch (e) {
      setPayError(e.message || 'Verification failed');
      setPaying(false);
    }
  };

  const submitRating = async () => {
    if (paymentStatus !== 'paid') {
      setPayError('Please complete payment before finishing');
      return;
    }
    try { await api(`/api/rides/${ride.id}/rate`, { method: 'POST', body: { rating: stars, tip } }); }
    catch { /* already rated / non-fatal */ }
    setPhase('set'); setRide(null); setDrop(null); setEstimate(null); setStars(5); setTip(0);
    setPaymentStatus(null); setPayError(''); setSheetOpen(false);
    showToast('Thanks for riding with Muve!');
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
        <div className="brand-logo">
          <img src="/logo.png" alt="muve" />
          <span>uve</span>
        </div>
        <div className="topbar-right">
          {estimate && phase === 'choose' && <div className="chip num">{fmtKm(estimate.distanceM)} · {fmtMin(estimate.durationS)}</div>}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      {sheetHidden && (
        <button className="go-btn" onClick={() => setSheetOpen(true)}>Go</button>
      )}

      <div className={`sheet ${sheetHidden ? 'sheet--hidden' : ''}`}>
        {(phase === 'set' || phase === 'choose') && sheetOpen && (
          <button className="sheet-close" onClick={closeSheet} aria-label="Close">×</button>
        )}
        <div className="sheet-grab" />

        {(phase === 'set' || phase === 'choose') && (
          <>
            {unpaidTrips.length > 0 && (
              <div className="unpaid-notice">
                You have {unpaidTrips.length} unpaid trip{unpaidTrips.length > 1 ? 's' : ''}. Go to Account → Payments to settle.
              </div>
            )}
            <h3 className="sheet-title">Where to, {user.name.split(' ')[0]}?</h3>
            <div className={`loc-input ${activeField === 'pickup' ? 'active' : ''}`} onClick={() => { setActiveField('pickup'); setQuery(pickup?.addr || ''); }}>
              <span className="dot green" />
              <input
                placeholder="Pick up"
                value={activeField === 'pickup' ? query : (pickup?.addr || '')}
                onChange={(e) => { setActiveField('pickup'); setQuery(e.target.value); if (!e.target.value) { setPickup(null); setDrop(null); setEstimate(null); setPhase('set'); } }}
                onFocus={() => { setActiveField('pickup'); setQuery(pickup?.addr || ''); }}
              />
              {pickup && (
                <button className="loc-save" onClick={(e) => { e.stopPropagation(); setSavingPlace('pickup'); setPlaceLabel(''); }} title="Save this place">＋</button>
              )}
            </div>
            <div className={`loc-input ${activeField === 'drop' ? 'active' : ''}`} onClick={() => { setActiveField('drop'); setQuery(drop?.addr || ''); }}>
              <span className="dot red" />
              <input
                placeholder="Destination"
                value={activeField === 'drop' ? query : (drop?.addr || '')}
                onChange={(e) => { setActiveField('drop'); setQuery(e.target.value); if (!e.target.value) { setDrop(null); setEstimate(null); setPhase('set'); } }}
                onFocus={() => { setActiveField('drop'); setQuery(drop?.addr || ''); }}
              />
              {drop && (
                <button className="loc-save" onClick={(e) => { e.stopPropagation(); setSavingPlace('drop'); setPlaceLabel(''); }} title="Save this place">＋</button>
              )}
            </div>
            {places.length > 0 && (
              <div className="places-row">
                {places.map((p) => (
                  <button key={p.id} className="place-chip" onClick={() => usePlace(p)}>
                    <span className="place-chip-label">{p.label}</span>
                    <span
                      className="place-chip-del"
                      onClick={(e) => { e.stopPropagation(); deletePlace(p.id).then(() => setPlaces((prev) => prev.filter((x) => x.id !== p.id))).catch(() => {}); }}
                      title="Remove"
                    >×</span>
                  </button>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((sug, i) => (
                  <button key={i} onClick={() => setLocation(activeField, sug)}><Icon name="pin" size={16} /> {sug.addr}</button>
                ))}
              </div>
            )}
            {!savingPlace && suggestions.length === 0 && (
              <div className="hint">Search above or tap the map to set your {activeField === 'pickup' ? 'pickup' : 'destination'}</div>
            )}

            {phase === 'choose' && estimate && (
              <div style={{ marginTop: 12 }}>
                <div className="tier-dropdown">
                  <button className="tier-dropdown-trigger" onClick={() => setTierOpen(!tierOpen)}>
                    <span className="t-icon"><Icon name={selectedTier?.icon} size={30} /></span>
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      <span className="t-name">{selectedTier?.name}</span>
                      <span className="muted" style={{ fontSize: 12 }}> · {selectedTier?.seats} seats</span>
                      {selectedTier?.surge > 1 && <span className="surge-tag">{selectedTier.surge}x surge</span>}
                    </span>
                    <span className="t-fare">{fmtMoney(selectedTier?.fare)}</span>
                    <span className="tier-caret">▾</span>
                  </button>
                  {tierOpen && (
                    <div className="tier-dropdown-menu">
                      {estimate.tiers.map((t) => (
                        <button key={t.key} className={`tier-option ${tier === t.key ? 'active' : ''}`}
                          onClick={() => { setTier(t.key); setTierOpen(false); setUseCustomFare(false); setProposedFare(null); }}>
                          <span className="t-icon"><Icon name={t.icon} size={30} /></span>
                          <span style={{ flex: 1, textAlign: 'left' }}>
                            <div className="t-name">{t.name} <span className="muted">· {t.seats} seats</span></div>
                            <div className="t-sub">{t.blurb}</div>
                          </span>
                          <span className="t-fare">{fmtMoney(t.fare)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="fare-propose" style={{ marginBottom: 12 }}>
                  <button className="fare-propose-toggle" onClick={() => { setUseCustomFare(!useCustomFare); setProposedFare(useCustomFare ? null : selectedTier?.fare); }}>
                    {useCustomFare ? 'Use suggested fare' : 'Propose your own fare'}
                  </button>
                  {useCustomFare && (
                    <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <span className="muted" style={{ fontSize: 13 }}>Your offer:</span>
                      <input className="num" type="number" min={selectedTier?.minFare || 100} step={50}
                        value={proposedFare || ''} onChange={(e) => setProposedFare(Number(e.target.value))}
                        style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', color: 'var(--ink)', fontSize: 16, fontWeight: 700 }}
                        placeholder={String(selectedTier?.fare || 0)} />
                      <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        Suggested: <span className="num">{fmtMoney(selectedTier?.fare)}</span>
                      </span>
                    </div>
                  )}
                </div>
                <button className="btn btn-dark btn-block" onClick={requestRide} disabled={busy}>
                  {busy ? 'Requesting…' : <span>Request {selectedTier?.name} · <span className="num">{fmtMoney(useCustomFare && proposedFare > 0 ? proposedFare : selectedTier?.fare)}</span></span>}
                </button>
                <button className="btn btn-light btn-block" style={{ marginTop: 8 }} onClick={() => { setPhase('set'); setDrop(null); setEstimate(null); setProposedFare(null); setUseCustomFare(false); }}>Cancel</button>
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
            {ride?.fareStatus === 'proposed' && (
              <div className="hint" style={{ marginTop: 8 }}>Your proposed fare: <span className="num">{fmtMoney(ride.fare)}</span> (suggested: <span className="num">{fmtMoney(ride.suggestedFare)}</span>)</div>
            )}
            <button className="btn btn-light btn-block" style={{ marginTop: 16 }} onClick={cancelRide}>Cancel request</button>
          </div>
        )}

        {phase === 'counter' && ride && (
          <div className="status-banner">
            <div className="s-title">Driver countered your fare</div>
            <div className="s-sub">A driver proposed a different fare for your trip</div>
            <div className="counter-compare" style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
                <div className="muted" style={{ fontSize: 11 }}>Your offer</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{fmtMoney(ride.proposedFare || ride.suggestedFare)}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 12, background: 'var(--surface-2)' }}>
                <div className="muted" style={{ fontSize: 11 }}>Driver's counter</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{fmtMoney(ride.fare)}</div>
              </div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-light" style={{ flex: 1 }} onClick={declineCounter}>Decline</button>
              <button className="btn btn-green" style={{ flex: 2 }} onClick={acceptCounter}>Accept · <span className="num">{fmtMoney(ride.fare)}</span></button>
            </div>
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
                  <div style={{ fontWeight: 800 }}>{ride.driver.name} <span className="muted num">★ {ride.driver.rating}</span></div>
                  <div className="muted">{ride.driver.vehicle?.color} {ride.driver.vehicle?.make} {ride.driver.vehicle?.model}</div>
                </div>
                <div className="plate">{ride.driver.vehicle?.plate}</div>
              </div>
            )}
            <div className="row spread" style={{ marginBottom: 12 }}>
              <span className="muted"><span className="num">{fmtKm(ride.distanceM)} · {fmtMin(ride.durationS)}</span></span>
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
            <div className="muted" style={{ margin: '6px 0 4px' }}>Total fare</div>
            <div className="big" style={{ fontSize: 32 }}>{fmtMoney(ride.fare + tip)}</div>

            {paymentStatus === 'paid' ? (
              <>
                <div className="muted" style={{ marginTop: 14, color: 'var(--green, #16a34a)', fontWeight: 700 }}>✓ Payment confirmed</div>
                <div className="muted" style={{ marginTop: 14 }}>Rate {ride.driver?.name?.split(' ')[0] || 'your driver'}</div>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>
                  ))}
                </div>
                <button className="btn btn-dark btn-block" onClick={submitRating}>Done</button>
              </>
            ) : (
              <>
                <div className="muted" style={{ marginTop: 14 }}>Rate {ride.driver?.name?.split(' ')[0] || 'your driver'}</div>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>
                  ))}
                </div>
                <div className="tip-row">
                  {[0, 200, 500, 1000].map((t) => (
                    <button key={t} className={`tip-btn ${tip === t ? 'active' : ''}`} onClick={() => setTip(t)}>
                      {t === 0 ? 'No tip' : fmtMoney(t)}
                    </button>
                  ))}
                </div>
                {payError && <div className="muted" style={{ color: 'var(--red, #d6323e)', margin: '8px 0' }}>{payError}</div>}
                {paymentStatus === 'pending' && <div className="muted" style={{ margin: '8px 0' }}>Confirming payment…</div>}
                <button className="btn btn-dark btn-block" onClick={startPaystackPayment} disabled={paying}>
                  {paying ? 'Processing…' : `Pay ${fmtMoney(ride.fare + tip)} with Paystack`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {savingPlace && (
        <div className="modal-overlay" onClick={() => { setSavingPlace(false); setPlaceLabel(''); }}>
          <div className="save-modal" onClick={(e) => e.stopPropagation()}>
            <div className="save-modal-title">Save this place</div>
            <input
              className="save-modal-input"
              placeholder="Label (e.g. Home, Work, Aunty's flat)"
              value={placeLabel}
              onChange={(e) => setPlaceLabel(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmSavePlace(); }}
            />
            <div className="save-modal-actions">
              <button className="btn btn-light" onClick={() => { setSavingPlace(false); setPlaceLabel(''); }}>Cancel</button>
              <button className="btn btn-dark" onClick={confirmSavePlace}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
