import React, { useEffect, useMemo, useRef, useState } from 'react';
import MapView from './MapView.jsx';
import { api, fmtMoney, fmtKm, fmtMin } from './api.js';
import { getSocket } from './socket.js';
import ThemeToggle from './ThemeToggle.jsx';

const DEFAULT_CENTER = [6.5244, 3.3792]; // Lagos

const NEXT_ACTION = {
  accepted: ['arrived', 'Arrived at pickup', 'btn-dark'],
  arrived: ['start', 'Start trip', 'btn-green'],
  in_progress: ['complete', 'Complete trip', 'btn-dark'],
};

export default function DriverHome({ user, theme, onToggleTheme }) {
  const [online, setOnline] = useState(false);
  const [pos, setPos] = useState(null); // {lat,lng}
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [offer, setOffer] = useState(null);
  const [countdown, setCountdown] = useState(15);
  const [ride, setRide] = useState(null);
  const [toast, setToast] = useState('');
  const [fitKey, setFitKey] = useState(0);
  const posRef = useRef(null);
  posRef.current = pos;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // Boot: geolocate + resume active ride
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(loc); setCenter([loc.lat, loc.lng]);
      },
      () => setPos({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
    api('/api/rides/current').then(({ ride: r }) => {
      if (r) { setRide(r); setOnline(true); setFitKey((k) => k + 1); }
    }).catch(() => {});
  }, []);

  // Socket wiring
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onOffer = (r) => { setOffer(r); setCountdown(r.expiresInS || 15); };
    const onOfferClosed = () => setOffer(null);
    const onUpdate = (r) => {
      setRide(['completed', 'cancelled'].includes(r.status) ? null : r);
      if (r.status === 'completed') showToast(`Trip complete — you earned ${fmtMoney(r.fare + (r.tip || 0))}`);
      if (r.status === 'cancelled') showToast('Ride was cancelled');
      if (r.status === 'accepted') { setOffer(null); setFitKey((k) => k + 1); }
    };
    s.on('ride:offer', onOffer);
    s.on('ride:offer:closed', onOfferClosed);
    s.on('ride:update', onUpdate);
    return () => { s.off('ride:offer', onOffer); s.off('ride:offer:closed', onOfferClosed); s.off('ride:update', onUpdate); };
  }, []);

  // Offer countdown
  useEffect(() => {
    if (!offer) return;
    if (countdown <= 0) { setOffer(null); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [offer, countdown]);

  // Stream GPS to server while online
  useEffect(() => {
    if (!online) return;
    const s = getSocket();
    s?.emit('driver:online', posRef.current || {});
    const watchId = navigator.geolocation?.watchPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading || 0 };
        setPos(loc);
        s?.emit('driver:location', loc);
      },
      () => {},
      { enableHighAccuracy: true }
    );
    const beat = setInterval(() => {
      if (posRef.current) s?.emit('driver:location', { heading: 0, ...posRef.current });
    }, 4000);
    return () => {
      if (watchId != null) navigator.geolocation?.clearWatch(watchId);
      clearInterval(beat);
    };
  }, [online]);

  const toggleOnline = () => {
    const s = getSocket();
    if (online) {
      if (ride) return showToast('Finish your current trip first');
      s?.emit('driver:offline');
      setOnline(false);
    } else {
      s?.emit('driver:online', pos || {});
      setOnline(true);
      showToast('You’re online — waiting for requests');
    }
  };

  const respond = (accept) => {
    const s = getSocket();
    if (!offer) return;
    s?.emit(accept ? 'offer:accept' : 'offer:decline', { rideId: offer.id });
    if (!accept) setOffer(null);
  };

  const doAction = async () => {
    const [action] = NEXT_ACTION[ride.status] || [];
    if (!action) return;
    try {
      const { ride: r } = await api(`/api/rides/${ride.id}/${action}`, { method: 'POST' });
      setRide(['completed', 'cancelled'].includes(r.status) ? null : r);
      if (r.status === 'completed') showToast(`Trip complete — you earned ${fmtMoney(r.fare)}`);
    } catch (e) { showToast(e.message); }
  };

  // Simulate movement by tapping the map (handy when testing on a desktop)
  const onMapClick = (ll) => {
    if (!online) return;
    const loc = { ...ll, heading: 0 };
    setPos(loc);
    getSocket()?.emit('driver:location', loc);
  };

  const markers = useMemo(() => {
    const list = [];
    if (pos) list.push({ id: 'me', kind: 'car', tracked: true, heading: pos.heading || 0, ...pos });
    if (ride) {
      list.push({ id: 'pickup', kind: 'pickup', ...ride.pickup });
      list.push({ id: 'drop', kind: 'drop', ...ride.drop });
    }
    return list;
  }, [pos, ride]);

  const [, actionLabel, actionClass] = NEXT_ACTION[ride?.status] || [];

  return (
    <>
      <MapView center={center} markers={markers} route={ride?.route || null} fitKey={fitKey} theme={theme} onMapClick={onMapClick} />
      <div className="topbar">
        <div className="brand-chip">muve</div>
        <div className="topbar-right">
          <div className="chip">{online ? '🟢 Online' : '⚫ Offline'}</div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      {!ride && (
        <button className={`go-btn ${online ? 'on' : 'off'}`} onClick={toggleOnline}>
          {online ? 'STOP' : 'GO'}
        </button>
      )}

      {!ride && (
        <div className="sheet" style={{ maxHeight: '22%' }}>
          <div className="sheet-grab" />
          <div className="row spread">
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{online ? 'You’re online' : 'You’re offline'}</div>
              <div className="muted">{online ? 'Waiting for ride requests…' : 'Tap GO to start earning'}</div>
            </div>
            {online && <div className="spinner" />}
          </div>
          {online && <div className="hint" style={{ textAlign: 'left', marginTop: 8 }}>Tip: tap anywhere on the map to simulate driving there.</div>}
        </div>
      )}

      {ride && (
        <div className="sheet">
          <div className="sheet-grab" />
          <div className="status-banner">
            <div className="s-title"><span className="pulse" />
              {ride.status === 'accepted' ? 'Head to pickup' : ride.status === 'arrived' ? 'Waiting for rider' : 'Trip in progress'}
            </div>
            <div className="s-sub">{ride.status === 'in_progress' ? `Drop-off: ${ride.drop.addr || 'destination'}` : `Pickup: ${ride.pickup.addr || 'pickup point'}`}</div>
          </div>
          <div className="driver-card">
            <div className="avatar">{ride.rider?.name?.[0] || '?'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{ride.rider?.name}</div>
              <div className="muted">{fmtKm(ride.distanceM)} · {fmtMin(ride.durationS)} · {ride.paymentMethod}</div>
            </div>
            <div className="big">{fmtMoney(ride.fare)}</div>
          </div>
          {actionLabel && <button className={`btn ${actionClass} btn-block`} onClick={doAction}>{actionLabel}</button>}
          {['accepted', 'arrived'].includes(ride.status) && (
            <button className="btn btn-ghost btn-block" style={{ marginTop: 6 }}
              onClick={async () => { try { await api(`/api/rides/${ride.id}/cancel`, { method: 'POST' }); setRide(null); } catch (e) { showToast(e.message); } }}>
              Cancel trip
            </button>
          )}
        </div>
      )}

      {offer && !ride && (
        <div className="offer-modal">
          <div className="offer-card">
            <div className="row spread">
              <div>
                <div style={{ fontWeight: 800, fontSize: 19 }}>New ride request</div>
                <div className="muted">{offer.rider?.name} · ★ {offer.rider?.rating}</div>
              </div>
              <div className="big">{fmtMoney(offer.fare)}</div>
            </div>
            <div className="countdown"><div style={{ width: `${(countdown / (offer.expiresInS || 15)) * 100}%` }} /></div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>
              <div className="row" style={{ marginBottom: 6 }}><span className="dot green" /><span>{offer.pickup.addr || 'Pickup'}</span></div>
              <div className="row"><span className="dot red" /><span>{offer.drop.addr || 'Destination'}</span></div>
            </div>
            <div className="muted" style={{ marginBottom: 14 }}>
              {fmtKm(offer.pickupDistM)} to pickup · trip {fmtKm(offer.distanceM)} · {fmtMin(offer.durationS)}
            </div>
            <div className="row">
              <button className="btn btn-light" style={{ flex: 1 }} onClick={() => respond(false)}>Decline</button>
              <button className="btn btn-green" style={{ flex: 2 }} onClick={() => respond(true)}>Accept · {countdown}s</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
