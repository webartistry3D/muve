import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtKm, getWallet, fundWallet, withdrawWallet, getBankAccount } from './api.js';
import { Icon } from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Pagination from './Pagination.jsx';
import { getSocket } from './socket.js';

const CATEGORY_ICONS = { Fuel: 'fuel', Repairs: 'wrench', Maintenance: 'wrench', Insurance: 'shield', Other: 'package' };
const PER_PAGE = 10;

export default function Earnings({ theme, onToggleTheme, user }) {
  const [tab, setTab] = useState('income');
  const [data, setData] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'Fuel', amount: '', note: '' });
  const [toast, setToast] = useState('');
  const [wallet, setWallet] = useState(null);

  // Withdraw state
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawErr, setWithdrawErr] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Fund state
  const [showFund, setShowFund] = useState(false);
  const [fundAccount, setFundAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  // Saved bank account (from Settings)
  const [savedBank, setSavedBank] = useState(null);

  // Pagination state
  const [tripsPage, setTripsPage] = useState(1);
  const [expensesPage, setExpensesPage] = useState(1);
  const [walletPage, setWalletPage] = useState(1);

  useEffect(() => {
    api('/api/driver/earnings').then(setData).catch(() => setData({ today: 0, week: 0, total: 0, trips: 0, recent: [] }));
    loadExpenses();
    loadWallet();
    getBankAccount().then((d) => { if (d.bankAccounts && d.bankAccounts.length) setSavedBank(d.bankAccounts[0]); }).catch(() => {});

    // Listen for wallet funding via socket
    const socket = getSocket();
    if (socket) {
      const onFunded = ({ amount, balance }) => {
        setWallet((w) => ({ ...w, balance }));
        setToast(`Wallet funded with ${fmtMoney(amount)}`);
        setTimeout(() => setToast(''), 3500);
        loadWallet();
      };
      socket.on('wallet:funded', onFunded);
      return () => socket.off('wallet:funded', onFunded);
    }
  }, []);

  const loadExpenses = () => {
    api('/api/driver/expenses').then(setExpenses).catch(() => setExpenses({ today: 0, week: 0, total: 0, expenses: [], categories: ['Fuel', 'Repairs', 'Maintenance', 'Insurance', 'Other'] }));
  };

  const loadWallet = () => {
    getWallet().then(setWallet).catch(() => setWallet({ balance: 0, transactions: [] }));
  };

  const generateAccount = async () => {
    setLoadingAccount(true);
    try {
      const d = await fundWallet();
      setFundAccount(d);
    } catch (e) {
      setToast(e.message || 'Could not generate account');
      setTimeout(() => setToast(''), 3500);
    } finally {
      setLoadingAccount(false);
    }
  };

  const openFund = () => {
    setShowFund(true);
    if (!fundAccount) generateAccount();
  };

  const doWithdraw = async () => {
    const amt = Number(withdrawAmt.replace(/,/g, ''));
    if (!amt || amt < 1000) { setWithdrawErr('Minimum withdrawal is ₦1,000'); return; }
    if (!savedBank) { setWithdrawErr('Add a bank account in Settings first'); return; }
    setWithdrawing(true);
    setWithdrawErr('');
    try {
      const res = await withdrawWallet(amt, savedBank.accountNumber, savedBank.bankCode);
      setWallet((w) => ({ ...w, balance: res.balance }));
      setToast(`Withdrawal of ${fmtMoney(amt)} initiated`);
      setTimeout(() => setToast(''), 3500);
      setShowWithdraw(false);
      setWithdrawAmt('');
      loadWallet();
    } catch (e) {
      setWithdrawErr(e.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
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
      <div className="page-header">
        <h2>Earnings</h2>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      {/* Wallet balance card */}
      {wallet && (
        <div className="wallet-card">
          <div className="wallet-label">Wallet balance</div>
          <div className="wallet-balance num">{fmtMoney(wallet.balance)}</div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-light wallet-btn" onClick={openFund}>
              <span className="row" style={{ gap: 6 }}><Icon name="plus" size={16} /> Fund</span>
            </button>
            <button className="btn btn-light wallet-btn" onClick={() => setShowWithdraw(true)}>
              <span className="row" style={{ gap: 6 }}><Icon name="cash" size={16} /> Withdraw</span>
            </button>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'income' ? 'active' : ''}`} onClick={() => setTab('income')}>Income</button>
        <button className={`tab ${tab === 'expense' ? 'active' : ''}`} onClick={() => setTab('expense')}>Expense</button>
        <button className={`tab ${tab === 'wallet' ? 'active' : ''}`} onClick={() => setTab('wallet')}>Wallet</button>
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
          {data.recent.slice((tripsPage - 1) * PER_PAGE, tripsPage * PER_PAGE).map((r) => (
            <div className="ride-item" key={r.id}>
              <div className="r-ico"><Icon name="cash" size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.drop.addr || 'Trip'}
                </div>
                <div className="muted">
                  {r.rider?.name} · <span className="num">{fmtKm(r.distanceM)}</span>
                  {r.rating ? ` · rated ★ ${r.rating}` : ''}
                </div>
              </div>
              <div style={{ fontWeight: 800, textAlign: 'right' }} className="num">
                {fmtMoney(r.fare + (r.tip || 0))}
                {r.tip > 0 && <div className="muted num" style={{ fontWeight: 600, textAlign: 'right' }}>incl. {fmtMoney(r.tip)} tip</div>}
              </div>
            </div>
          ))}
          <Pagination page={tripsPage} totalPages={Math.ceil(data.recent.length / PER_PAGE)} onPageChange={setTripsPage} />
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
              {expenses.expenses.slice((expensesPage - 1) * PER_PAGE, expensesPage * PER_PAGE).map((e) => (
                <div className="ride-item" key={e.id}>
                  <div className="r-ico expense-ico"><Icon name={CATEGORY_ICONS[e.category] || 'package'} size={20} /></div>
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
              <Pagination page={expensesPage} totalPages={Math.ceil(expenses.expenses.length / PER_PAGE)} onPageChange={setExpensesPage} />

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

      {tab === 'wallet' && wallet && (
        <>
          <h2 style={{ fontSize: 18 }}>Transaction history</h2>
          {wallet.transactions.length === 0 && <p className="muted">No transactions yet. Earnings from completed trips will appear here.</p>}
          {wallet.transactions.slice((walletPage - 1) * PER_PAGE, walletPage * PER_PAGE).map((t) => {
            const isCredit = t.amount > 0;
            const typeLabel = {
              TRIP_EARNING: 'Trip earning',
              MUVE_COMMISSION: 'Muve daily fee',
              WITHDRAWAL: 'Withdrawal',
              WITHDRAWAL_REVERSAL: 'Withdrawal reversed',
              WALLET_FUND: 'Wallet funding',
              ADJUSTMENT: 'Adjustment',
              credit: 'Credit',
            }[t.type] || t.description;
            const icon = t.type === 'MUVE_COMMISSION' ? 'cash' : t.type === 'WITHDRAWAL' ? 'plus' : t.type === 'WALLET_FUND' ? 'plus' : 'cash';
            return (
              <div className="ride-item" key={t.id}>
                <div className="r-ico"><Icon name={icon} size={20} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{typeLabel}</div>
                  <div className="muted num">{fmtDate(t.date)}</div>
                </div>
                <div style={{ fontWeight: 800, color: isCredit ? 'var(--green)' : 'var(--red)' }} className="num">
                  {isCredit ? '+' : ''}{fmtMoney(Math.abs(t.amount))}
                </div>
              </div>
            );
          })}
          <Pagination page={walletPage} totalPages={Math.ceil(wallet.transactions.length / PER_PAGE)} onPageChange={setWalletPage} />
        </>
      )}

      {/* Fund wallet modal */}
      {showFund && (
        <div className="modal-overlay" onClick={() => setShowFund(false)}>
          <div className="save-modal" onClick={(e) => e.stopPropagation()}>
            <div className="save-modal-title">Fund wallet</div>
            {loadingAccount ? (
              <div className="row" style={{ justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
            ) : fundAccount?.accountNumber ? (
              <>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Transfer money to the account below. Your wallet will be credited automatically.
                </p>
                <div className="fund-account-box">
                  <div className="muted">Bank</div>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>{fundAccount.bankName}</div>
                  <div className="muted">Account number</div>
                  <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 20 }} className="num">{fundAccount.accountNumber}</span>
                    <button className="btn btn-light" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => { navigator.clipboard.writeText(fundAccount.accountNumber); setToast('Account number copied'); setTimeout(() => setToast(''), 2000); }}>Copy</button>
                  </div>
                </div>
              </>
            ) : (
              <p className="muted">Could not generate account. Please try again.</p>
            )}
            <div className="save-modal-actions">
              <button className="btn btn-light" onClick={() => setShowFund(false)}>Close</button>
              <button className="btn btn-dark" onClick={generateAccount} disabled={loadingAccount}>Refresh</button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {showWithdraw && wallet && (
        <div className="modal-overlay" onClick={() => { setShowWithdraw(false); setWithdrawErr(''); setWithdrawAmt(''); }}>
          <div className="save-modal" onClick={(e) => e.stopPropagation()}>
            <div className="save-modal-title">Withdraw to bank</div>
            <div className="muted" style={{ marginBottom: 12 }}>Available: <span className="num" style={{ fontWeight: 700 }}>{fmtMoney(wallet.balance)}</span></div>
            {savedBank ? (
              <div className="fund-account-box" style={{ marginBottom: 12 }}>
                <div className="muted" style={{ fontSize: 12 }}>Withdrawing to</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{savedBank.bankName}</div>
                <div className="num" style={{ fontWeight: 700 }}>{savedBank.accountNumber}</div>
              </div>
            ) : (
              <div className="muted" style={{ color: 'var(--red)', marginBottom: 10, fontSize: 13 }}>
                No bank account saved. Add one in Settings to enable withdrawals.
              </div>
            )}
            <input
              className="save-modal-input num"
              type="text"
              inputMode="numeric"
              placeholder="Amount (min ₦1,000)"
              value={withdrawAmt}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, '');
                setWithdrawAmt(raw ? Number(raw).toLocaleString('en-NG') : '');
              }}
              autoFocus
            />
            {withdrawErr && <div className="muted" style={{ color: 'var(--red)', marginBottom: 10 }}>{withdrawErr}</div>}
            <div className="save-modal-actions">
              <button className="btn btn-light" onClick={() => { setShowWithdraw(false); setWithdrawErr(''); setWithdrawAmt(''); }}>Cancel</button>
              <button className="btn btn-dark" onClick={doWithdraw} disabled={withdrawing || !savedBank}>{withdrawing ? 'Processing…' : 'Withdraw'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s + 'Z');
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}
