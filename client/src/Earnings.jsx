import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtKm } from './api.js';
import { Icon } from './Icons.jsx';

export default function Earnings() {
  const [tab, setTab] = useState('income');
  const [data, setData] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'Fuel', amount: '', note: '' });
  const [toast, setToast] = useState('');

  useEffect(() => {
    api('/api/driver/earnings').then(setData).catch(() => setData({ today: 0, week: 0, total: 0, trips: 0, recent: [] }));
    loadExpenses();
  }, []);

  const loadExpenses = () => {
    api('/api/driver/expenses').then(setExpenses).catch(() => setExpenses({ today: 0, week: 0, total: 0, expenses: [], categories: ['Fuel', 'Repairs', 'Maintenance', 'Insurance', 'Other'] }));
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount.replace(/,/g, '')) <= 0) return;
    try {
      const res = await api('/api/driver/expenses', { method: 'POST', body: { ...form, amount: Number(form.amount.replace(/,/g, '')) } });
      setExpenses(res);
      const amt = Number(form.amount.replace(/,/g, ''));
      setToast(`Expense recorded — ${form.category}: ${fmtMoney(amt)}`);
      setTimeout(() => setToast(''), 3500);
      setForm({ category: 'Fuel', amount: '', note: '' });
      setShowForm(false);
    } catch { /* ignore */ }
  };

  const deleteExpense = async (id) => {
    try {
      const res = await api(`/api/driver/expenses/${id}`, { method: 'DELETE' });
      setExpenses(res);
    } catch { /* ignore */ }
  };

  if (!data) return <div className="page"><div className="row" style={{ justifyContent: 'center', padding: 30 }}><div className="spinner" /></div></div>;

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}
      <h2>Earnings</h2>
      <div className="tabs">
        <button className={`tab ${tab === 'income' ? 'active' : ''}`} onClick={() => setTab('income')}>Income</button>
        <button className={`tab ${tab === 'expense' ? 'active' : ''}`} onClick={() => setTab('expense')}>Expense</button>
      </div>

      {tab === 'income' && (
        <>
          <div className="stat-grid">
            <div className="stat"><div className="v num">{fmtMoney(data.today)}</div><div className="k">Today</div></div>
            <div className="stat"><div className="v num">{fmtMoney(data.week)}</div><div className="k">This week</div></div>
            <div className="stat"><div className="v num">{fmtMoney(data.total)}</div><div className="k">All time · {data.trips} trips</div></div>
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
                  {r.rider?.name} · <span className="num">{fmtKm(r.distanceM)}</span>
                  {r.rating ? ` · rated ★ ${r.rating}` : ''}
                </div>
              </div>
              <div style={{ fontWeight: 800 }} className="num">
                {fmtMoney(r.fare + (r.tip || 0))}
                {r.tip > 0 && <div className="muted num" style={{ fontWeight: 600, textAlign: 'right' }}>incl. {fmtMoney(r.tip)} tip</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'expense' && (
        <>
          {!expenses ? (
            <div className="row" style={{ justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>
          ) : (
            <>
              <div className="stat-grid">
                <div className="stat expense-stat"><div className="v num">{fmtMoney(expenses.today)}</div><div className="k">Today</div></div>
                <div className="stat expense-stat"><div className="v num">{fmtMoney(expenses.week)}</div><div className="k">This week</div></div>
                <div className="stat expense-stat"><div className="v num">{fmtMoney(expenses.total)}</div><div className="k">All time</div></div>
              </div>

              {!showForm ? (
                <button className="btn btn-dark btn-block" style={{ marginBottom: 16 }} onClick={() => setShowForm(true)}>
                  <span className="row" style={{ gap: 6 }}><Icon name="plus" size={18} /> Add expense</span>
                </button>
              ) : (
                <form className="expense-form" onSubmit={addExpense} style={{ marginBottom: 16 }}>
                  <div className="field">
                    <label>Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {(expenses.categories || ['Fuel', 'Repairs', 'Maintenance', 'Insurance', 'Other']).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Amount (₦)</label>
                    <input className="num" type="text" inputMode="numeric" value={form.amount} required
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, '');
                        setForm({ ...form, amount: raw ? Number(raw).toLocaleString('en-NG') : '' });
                      }} placeholder="e.g. 5,000" />
                  </div>
                  <div className="field">
                    <label>Note (optional)</label>
                    <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Full tank" />
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button type="button" className="btn btn-light" style={{ flex: 1 }} onClick={() => { setShowForm(false); setForm({ category: 'Fuel', amount: '', note: '' }); }}>Cancel</button>
                    <button type="submit" className="btn btn-dark" style={{ flex: 2 }}>Save expense</button>
                  </div>
                </form>
              )}

              <h2 style={{ fontSize: 18 }}>Recent expenses</h2>
              {expenses.expenses.length === 0 && <p className="muted">No expenses logged yet.</p>}
              {expenses.expenses.map((e) => (
                <div className="ride-item" key={e.id}>
                  <div className="r-ico expense-ico">{categoryIcon(e.category)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{e.category}</div>
                    <div className="muted">
                      {e.note ? `${e.note} · ` : ''}<span className="num">{fmtDate(e.createdAt)}</span>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--red)' }} className="num">
                    -{fmtMoney(e.amount)}
                  </div>
                  <button className="expense-del" onClick={() => deleteExpense(e.id)} title="Delete">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}

              {expenses.expenses.length > 0 && (
                <div className="net-summary" style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--surface-2)' }}>
                  <div className="row spread">
                    <span className="muted">Net (income - expenses)</span>
                    <span className="num" style={{ fontWeight: 800, fontSize: 18, color: data.total - expenses.total >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmtMoney(data.total - expenses.total)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s + 'Z');
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

function categoryIcon(cat) {
  const icons = { Fuel: '⛽', Repairs: '🔧', Maintenance: '🛠️', Insurance: '📋', Other: '📦' };
  return icons[cat] || '📦';
}
