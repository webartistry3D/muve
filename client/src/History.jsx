import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtKm } from './api.js';
import Icon from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Pagination from './Pagination.jsx';

const PER_PAGE = 10;

// Timestamps arrive either as SQLite "YYYY-MM-DD HH:MM:SS" (UTC) or ISO strings
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function History({ theme, onToggleTheme }) {
  const [rides, setRides] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api('/api/rides/history').then((d) => setRides(d.rides)).catch(() => setRides([]));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Activity</h2>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      {rides === null && <div className="row" style={{ justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>}
      {rides?.length === 0 && <p className="muted">No trips yet. Your rides will show up here.</p>}
      {rides?.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((r) => (
        <div className="ride-item" key={r.id}>
          <div className="r-ico"><Icon name={r.status === 'completed' ? 'carfront' : 'trash'} size={22} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.drop.addr || `${r.drop.lat.toFixed(3)}, ${r.drop.lng.toFixed(3)}`}
            </div>
            <div className="muted">
              {fmtDate(r.completedAt || r.requestedAt)}
              {' · '}<span className="num">{fmtKm(r.distanceM)}</span>
              {r.driver && <> · {r.driver.name}</>}
            </div>
            <div style={{ marginTop: 4 }}>
              <span className={`badge ${r.status === 'completed' ? 'done' : 'cancel'}`}>
                {r.status === 'completed' ? 'Completed' : `Cancelled${r.cancelledBy ? ` by ${r.cancelledBy}` : ''}`}
              </span>
              {r.rating && <span className="muted num" style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icon name="star" size={14} /> {r.rating}</span>}
            </div>
          </div>
          <div style={{ fontWeight: 800 }} className="num">{fmtMoney(r.fare + (r.tip || 0))}</div>
        </div>
      ))}
      {rides && <Pagination page={page} totalPages={Math.ceil(rides.length / PER_PAGE)} onPageChange={setPage} />}
    </div>
  );
}
