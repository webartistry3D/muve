import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtKm } from './api.js';

// Timestamps arrive either as SQLite "YYYY-MM-DD HH:MM:SS" (UTC) or ISO strings
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function History() {
  const [rides, setRides] = useState(null);

  useEffect(() => {
    api('/api/rides/history').then((d) => setRides(d.rides)).catch(() => setRides([]));
  }, []);

  return (
    <div className="page">
      <h2>Activity</h2>
      {rides === null && <div className="row" style={{ justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>}
      {rides?.length === 0 && <p className="muted">No trips yet. Your rides will show up here.</p>}
      {rides?.map((r) => (
        <div className="ride-item" key={r.id}>
          <div className="r-ico">{r.status === 'completed' ? '🚗' : '🚫'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.drop.addr || `${r.drop.lat.toFixed(3)}, ${r.drop.lng.toFixed(3)}`}
            </div>
            <div className="muted">
              {fmtDate(r.completedAt || r.requestedAt)}
              {' · '}{fmtKm(r.distanceM)}
              {r.driver && <> · {r.driver.name}</>}
            </div>
            <div style={{ marginTop: 4 }}>
              <span className={`badge ${r.status === 'completed' ? 'done' : 'cancel'}`}>
                {r.status === 'completed' ? 'Completed' : `Cancelled${r.cancelledBy ? ` by ${r.cancelledBy}` : ''}`}
              </span>
              {r.rating && <span className="muted" style={{ marginLeft: 8 }}>★ {r.rating}</span>}
            </div>
          </div>
          <div style={{ fontWeight: 800 }}>{fmtMoney(r.fare + (r.tip || 0))}</div>
        </div>
      ))}
    </div>
  );
}
