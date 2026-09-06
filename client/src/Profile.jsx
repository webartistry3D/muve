import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import Icon from './Icons.jsx';

const ID_TYPES = [
  { value: 'nin', label: 'NIN (National ID)' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voters_card', label: "Voter's Card" },
  { value: 'passport', label: 'International Passport' },
];

const NG_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function Profile({ user, onLogout }) {
  const [methods, setMethods] = useState([]);
  const [adding, setAdding] = useState(false);
  const [card, setCard] = useState({ brand: 'Visa', last4: '' });

  // KYC state
  const [kyc, setKyc] = useState(null);
  const [editingKyc, setEditingKyc] = useState(false);
  const [kycForm, setKycForm] = useState({ full_name: '', phone: '', dob: '', id_type: 'nin', id_number: '', address: '', city: '', state: 'Lagos', license_number: '', vehicle_reg: '' });
  const [kycBusy, setKycBusy] = useState(false);
  const [kycError, setKycError] = useState('');

  const loadPayments = () => api('/api/payments').then((d) => setMethods(d.methods)).catch(() => {});
  const loadKyc = () => api('/api/kyc').then((d) => setKyc(d.kyc)).catch(() => {});
  useEffect(() => { loadPayments(); loadKyc(); }, []);

  const addCard = async (e) => {
    e.preventDefault();
    if (card.last4.length !== 4) return;
    await api('/api/payments', { method: 'POST', body: card });
    setCard({ brand: 'Visa', last4: '' });
    setAdding(false);
    loadPayments();
  };

  const submitKyc = async (e) => {
    e.preventDefault();
    setKycBusy(true);
    setKycError('');
    try {
      const { kyc: updated } = await api('/api/kyc', { method: 'POST', body: kycForm });
      setKyc(updated);
      setEditingKyc(false);
    } catch (err) {
      setKycError(err.message || 'Failed to save KYC');
    } finally {
      setKycBusy(false);
    }
  };

  const startEditKyc = () => {
    if (kyc) {
      setKycForm({
        full_name: kyc.full_name, phone: kyc.phone, dob: kyc.dob,
        id_type: kyc.id_type, id_number: kyc.id_number,
        address: kyc.address, city: kyc.city, state: kyc.state,
        license_number: kyc.license_number || '', vehicle_reg: kyc.vehicle_reg || '',
      });
    } else {
      setKycForm({ full_name: user.name, phone: '', dob: '', id_type: 'nin', id_number: '', address: '', city: '', state: 'Lagos', license_number: '', vehicle_reg: '' });
    }
    setEditingKyc(true);
  };

  const kycStatusBadge = (status) => {
    const map = { pending: 'kyc-pending', verified: 'kyc-verified', rejected: 'kyc-rejected' };
    return <span className={`kyc-badge ${map[status] || 'kyc-pending'}`}>{status}</span>;
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
              {user.role === 'driver' ? 'Driver' : 'Rider'} · <span className="num">★ {user.rating || '5.0'}</span>
              {user.role === 'driver' && user.vehicle && ` · ${user.vehicle.make} ${user.vehicle.model} (`}<span className="num">{user.vehicle?.plate}</span>{user.role === 'driver' && user.vehicle && `)`}
            </div>
          </div>
        </div>
      </div>

      {/* KYC Section — rider & driver */}
      <div className="card">
        <div className="row spread" style={{ marginBottom: 8 }}>
          <div className="row" style={{ gap: 8, fontWeight: 800 }}>
            <Icon name="lock" size={18} /> Identity Verification (KYC)
          </div>
          {kyc && !editingKyc && kycStatusBadge(kyc.status)}
        </div>

        {!kyc && !editingKyc && (
          <>
            <p className="set-sub" style={{ marginBottom: 12 }}>
              {user.role === 'driver'
                ? 'Verify your identity to drive with muve. Required before you can accept rides.'
                : 'Verify your identity to ride with muve. Required for cashless payments.'}
            </p>
            <button className="btn btn-dark btn-block" onClick={startEditKyc}>
              <span className="row" style={{ gap: 6 }}><Icon name="plus" size={18} /> Start verification</span>
            </button>
            </>
          )}

          {kyc && !editingKyc && (
            <>
              <div className="kyc-info">
                <div className="kyc-row"><span className="muted">Full name</span><span>{kyc.full_name}</span></div>
                <div className="kyc-row"><span className="muted">Phone</span><span>{kyc.phone}</span></div>
                <div className="kyc-row"><span className="muted">Date of birth</span><span>{kyc.dob}</span></div>
                <div className="kyc-row"><span className="muted">ID type</span><span>{ID_TYPES.find((t) => t.value === kyc.id_type)?.label || kyc.id_type}</span></div>
                <div className="kyc-row"><span className="muted">ID number</span><span className="num">••••••{kyc.id_number?.slice(-4)}</span></div>
                <div className="kyc-row"><span className="muted">Address</span><span>{kyc.address}, {kyc.city}, {kyc.state}</span></div>
                {user.role === 'driver' && kyc.license_number && (
                  <div className="kyc-row"><span className="muted">License no.</span><span className="num">••••••{kyc.license_number?.slice(-4)}</span></div>
                )}
                {user.role === 'driver' && kyc.vehicle_reg && (
                  <div className="kyc-row"><span className="muted">Vehicle reg.</span><span>{kyc.vehicle_reg}</span></div>
                )}
              </div>
              <button className="btn btn-light btn-block" style={{ marginTop: 12 }} onClick={startEditKyc}>Update KYC</button>
            </>
          )}

          {editingKyc && (
            <form onSubmit={submitKyc} style={{ marginTop: 4 }}>
              {kycError && <div className="err">{kycError}</div>}
              <div className="field">
                <label>Full name</label>
                <input value={kycForm.full_name} required placeholder="As on your ID"
                  onChange={(e) => setKycForm({ ...kycForm, full_name: e.target.value })} />
              </div>
              <div className="vehicle-grid">
                <div className="field">
                  <label>Phone number</label>
                  <input className="num" value={kycForm.phone} required placeholder="0801 234 5678" maxLength={14}
                    onChange={(e) => setKycForm({ ...kycForm, phone: e.target.value })} />
                </div>
                <div className="field">
                  <label>Date of birth</label>
                  <input className="num" type="date" value={kycForm.dob} required
                    onChange={(e) => setKycForm({ ...kycForm, dob: e.target.value })} />
                </div>
              </div>
              <div className="vehicle-grid">
                <div className="field">
                  <label>ID type</label>
                  <select value={kycForm.id_type} onChange={(e) => setKycForm({ ...kycForm, id_type: e.target.value })}>
                    {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>ID number</label>
                  <input className="num" value={kycForm.id_number} required placeholder="e.g. 12345678901"
                    onChange={(e) => setKycForm({ ...kycForm, id_number: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Residential address</label>
                <input value={kycForm.address} required placeholder="House no, street, area"
                  onChange={(e) => setKycForm({ ...kycForm, address: e.target.value })} />
              </div>
              <div className="vehicle-grid">
                <div className="field">
                  <label>City</label>
                  <input value={kycForm.city} required placeholder="e.g. Festac Town"
                    onChange={(e) => setKycForm({ ...kycForm, city: e.target.value })} />
                </div>
                <div className="field">
                  <label>State</label>
                  <select value={kycForm.state} onChange={(e) => setKycForm({ ...kycForm, state: e.target.value })}>
                    {NG_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {user.role === 'driver' && (
                <div className="vehicle-grid">
                  <div className="field">
                    <label>Driver's license no.</label>
                    <input className="num" value={kycForm.license_number} required placeholder="e.g. ABC123456"
                      onChange={(e) => setKycForm({ ...kycForm, license_number: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Vehicle registration</label>
                    <input className="num" value={kycForm.vehicle_reg} required placeholder="e.g. LAG123AB"
                      onChange={(e) => setKycForm({ ...kycForm, vehicle_reg: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="row" style={{ gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-light btn-block" onClick={() => setEditingKyc(false)}>Cancel</button>
                <button type="submit" className="btn btn-dark btn-block" disabled={kycBusy}>{kycBusy ? 'Saving…' : 'Save KYC'}</button>
              </div>
            </form>
          )}
      </div>

      <div className="card">
        <div className="row spread" style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}>Payment methods</div>
          <button className="link-btn" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : (<span className="row" style={{ gap: 4 }}><Icon name="plus" size={16} /> Add card</span>)}
          </button>
        </div>
        {methods.map((m) => (
          <div className="row spread" key={m.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="row" style={{ gap: 10 }}>
              <Icon name={m.brand === 'Cash' ? 'cash' : 'card'} size={20} />
              {m.label || <span className="num">{`${m.brand} •••• ${m.last4}`}</span>}
            </span>
            {m.brand !== 'Cash' && (
              <button className="btn-ghost row" style={{ gap: 4 }} onClick={async () => { await api(`/api/payments/${m.id}`, { method: 'DELETE' }); loadPayments(); }}>
                <Icon name="trash" size={16} /> Remove
              </button>
            )}
          </div>
        ))}
        {adding && (
          <form onSubmit={addCard} style={{ marginTop: 12 }}>
            <div className="vehicle-grid">
              <div className="field">
                <label>Brand</label>
                <select value={card.brand} onChange={(e) => setCard({ ...card, brand: e.target.value })}>
                  <option>Visa</option><option>Mastercard</option><option>Amex</option><option>Verve</option>
                </select>
              </div>
              <div className="field">
                <label>Last 4 digits</label>
                <input className="num" value={card.last4} maxLength={4} pattern="\d{4}" required placeholder="4242"
                  onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>
            <button className="btn btn-dark btn-block">Save card</button>
          </form>
        )}
      </div>

      {/* <button className="btn btn-light btn-block btn-red" style={{ background: 'rgba(214,50,62,.12)', color: 'var(--red)', border: 'none' }} onClick={onLogout}>
        Log out
      </button> */}
      <p className="hint" style={{ marginTop: 16 }}>muve <span className="num">v1.0</span> — Built for Nigeria</p>
    </div>
  );
}
