import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export default function Profile({ user, onLogout }) {
  const [methods, setMethods] = useState([]);
  const [adding, setAdding] = useState(false);
  const [card, setCard] = useState({ brand: 'Visa', last4: '' });

  const load = () => api('/api/payments').then((d) => setMethods(d.methods)).catch(() => {});
  useEffect(() => { load(); }, []);

  const addCard = async (e) => {
    e.preventDefault();
    if (card.last4.length !== 4) return;
    await api('/api/payments', { method: 'POST', body: card });
    setCard({ brand: 'Visa', last4: '' });
    setAdding(false);
    load();
  };

  return (
    <div className="page">
      <h2>Account</h2>
      <div className="card">
        <div className="row">
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{user.name[0]}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{user.name}</div>
            <div className="muted">{user.email}</div>
            <div className="muted">
              {user.role === 'driver' ? '🚕 Driver' : '🧍 Rider'} · ★ {user.rating || '5.0'}
              {user.role === 'driver' && user.vehicle && ` · ${user.vehicle.make} ${user.vehicle.model} (${user.vehicle.plate})`}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row spread" style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}>Payment methods</div>
          <button className="link-btn" onClick={() => setAdding(!adding)}>{adding ? 'Close' : '+ Add card'}</button>
        </div>
        {methods.map((m) => (
          <div className="row spread" key={m.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{m.brand === 'Cash' ? '💵' : '💳'} {m.label || `${m.brand} •••• ${m.last4}`}</span>
            {m.brand !== 'Cash' && (
              <button className="btn-ghost" onClick={async () => { await api(`/api/payments/${m.id}`, { method: 'DELETE' }); load(); }}>Remove</button>
            )}
          </div>
        ))}
        {adding && (
          <form onSubmit={addCard} style={{ marginTop: 12 }}>
            <div className="vehicle-grid">
              <div className="field">
                <label>Brand</label>
                <select value={card.brand} onChange={(e) => setCard({ ...card, brand: e.target.value })}>
                  <option>Visa</option><option>Mastercard</option><option>Amex</option><option>RuPay</option>
                </select>
              </div>
              <div className="field">
                <label>Last 4 digits</label>
                <input value={card.last4} maxLength={4} pattern="\d{4}" required placeholder="4242"
                  onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>
            <button className="btn btn-dark btn-block">Save card</button>
          </form>
        )}
      </div>

      <button className="btn btn-light btn-block btn-red" style={{ background: '#fdecec', color: 'var(--red)', border: 'none' }} onClick={onLogout}>
        Log out
      </button>
      <p className="hint" style={{ marginTop: 16 }}>zber v1.0 — demo app. Payments are simulated.</p>
    </div>
  );
}
