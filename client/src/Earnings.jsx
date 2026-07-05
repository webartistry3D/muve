import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtKm } from './api.js';

export default function Earnings() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/api/driver/earnings').then(setData).catch(() => setData({ today: 0, week: 0, total: 0, trips: 0, recent: [] }));
  }, []);

  if (!data) return <div className="page"><div className="row" style={{ justifyContent: 'center', padding: 30 }}><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <h2>Earnings</h2>
      <div className="stat-grid">
        <div className="stat"><div className="v">{fmtMoney(data.today)}</div><div className="k">Today</div></div>
        <div className="stat"><div className="v">{fmtMoney(data.week)}</div><div className="k">This week</div></div>
        <div className="stat"><div className="v">{fmtMoney(data.total)}</div><div className="k">All time · {data.trips} trips</div></div>
      </div>
      <h2 style={{ fontSize: 18 }}>Recent trips</h2>
      {data.recent.length === 0 && <p className="muted">Complete trips to see them here.</p>}
      {data.recent.map((r) => (
        <div className="ride-item" key={r.id}>
          <div className="r-ico">💵</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.drop.addr || 'Trip'}
            </div>
            <div className="muted">
              {r.rider?.name} · {fmtKm(r.distanceM)}
              {r.rating ? ` · rated ★ ${r.rating}` : ''}
            </div>
          </div>
          <div style={{ fontWeight: 800 }}>
            {fmtMoney(r.fare + (r.tip || 0))}
            {r.tip > 0 && <div className="muted" style={{ fontWeight: 600, textAlign: 'right' }}>incl. {fmtMoney(r.tip)} tip</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
