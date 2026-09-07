import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, setSession } from './api.js';
import { Icon } from './Icons.jsx';

const ease = [0.16, 1, 0.3, 1];

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('rider');
  const [form, setForm] = useState({ name: '', email: '', password: '', make: '', model: '', plate: '', color: '', tier: 'muvex' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
      <motion.div
        className="auth-logo"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
      >
        muve
      </motion.div>
      <motion.div
        className="auth-tag"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease }}
      >
        Get there. Your day belongs to you.
      </motion.div>
      <motion.form
        className="auth-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease }}
      >
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        {err && <div className="err">{err}</div>}

        <AnimatePresence mode="wait">
          {mode === 'register' && (
            <motion.div
              key="register-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease }}
              style={{ overflow: 'hidden' }}
            >
              <div className="role-row">
                <button type="button" className={`role-btn ${role === 'rider' ? 'active' : ''}`} onClick={() => setRole('rider')}><Icon name="user" size={18} /> <span>Passenger</span></button>
                <button type="button" className={`role-btn ${role === 'driver' ? 'active' : ''}`} onClick={() => setRole('driver')}><Icon name="car" size={18} /> <span>Driver</span></button>
              </div>
              <div className="field"><label>Full name</label><input value={form.name} onChange={set('name')} required placeholder="Alex Rider" /></div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" /></div>
        <div className="field" style={{ position: 'relative' }}>
          <label>Password</label>
          <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={4} placeholder="••••••••" style={{ paddingRight: 40 }} />
          <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>
            <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'register' && role === 'driver' && (
            <motion.div
              key="driver-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease }}
              style={{ overflow: 'hidden' }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          className="btn btn-dark btn-block"
          disabled={busy}
          whileTap={{ scale: 0.98 }}
          animate={{ opacity: busy ? 0.7 : 1 }}
        >
          {busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </motion.button>
        <p style={{ marginTop: 14, fontSize: 14, textAlign: 'center' }}>
          {mode === 'login' ? "New to muve? " : 'Already have an account? '}
          <button type="button" className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </motion.form>
    </div>
  );
}
