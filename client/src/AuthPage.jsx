import React, { useState } from 'react';
import { api, setSession } from './api.js';

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('rider');
  const [form, setForm] = useState({ name: '', email: '', password: '', make: '', model: '', plate: '', color: '', tier: 'muvex' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : {
            name: form.name, email: form.email, password: form.password, role,
            vehicle: role === 'driver'
              ? { make: form.make, model: form.model, plate: form.plate, color: form.color, tier: form.tier }
              : undefined,
          };
      const data = await api(`/api/auth/${mode}`, { method: 'POST', body });
      setSession(data.token, data.user);
      onAuth(data.user);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-logo">muve</div>
      <div className="auth-tag">Get there. Your day belongs to you.</div>
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        {err && <div className="err">{err}</div>}

        {mode === 'register' && (
          <>
            <div className="role-row">
              <button type="button" className={`role-btn ${role === 'rider' ? 'active' : ''}`} onClick={() => setRole('rider')}>🧍 Rider</button>
              <button type="button" className={`role-btn ${role === 'driver' ? 'active' : ''}`} onClick={() => setRole('driver')}>🚕 Driver</button>
            </div>
            <div className="field"><label>Full name</label><input value={form.name} onChange={set('name')} required placeholder="Alex Rider" /></div>
          </>
        )}

        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" /></div>
        <div className="field"><label>Password</label><input type="password" value={form.password} onChange={set('password')} required minLength={4} placeholder="••••••••" /></div>

        {mode === 'register' && role === 'driver' && (
          <>
            <div className="vehicle-grid">
              <div className="field"><label>Car make</label><input value={form.make} onChange={set('make')} required placeholder="Toyota" /></div>
              <div className="field"><label>Model</label><input value={form.model} onChange={set('model')} required placeholder="Prius" /></div>
              <div className="field"><label>Plate</label><input value={form.plate} onChange={set('plate')} required placeholder="ZB 4821" /></div>
              <div className="field"><label>Color</label><input value={form.color} onChange={set('color')} required placeholder="Black" /></div>
            </div>
            <div className="field">
              <label>Service tier</label>
              <select value={form.tier} onChange={set('tier')}>
                <option value="muvex">MuveX</option>
                <option value="muvexl">MuveXL</option>
                <option value="black">Muve Black</option>
              </select>
            </div>
          </>
        )}

        <button className="btn btn-dark btn-block" disabled={busy}>
          {busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
        <p style={{ marginTop: 14, fontSize: 14, textAlign: 'center' }}>
          {mode === 'login' ? "New to muve? " : 'Already have an account? '}
          <button type="button" className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}
