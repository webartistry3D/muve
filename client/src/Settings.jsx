import React, { useState, useEffect } from 'react';
import Icon from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { TermsPage, PrivacyPage, HelpPage } from './LegalPages.jsx';
import { getBankAccount, saveBankAccount, deleteBankAccount, submitFeedback } from './api.js';

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '035', name: 'ALAT by Wema' },
  { code: '401', name: 'ASO Savings and Loans' },
  { code: '502', name: 'Atlas Microfinance Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '063', name: 'Diamond Bank' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '562', name: 'Eyowo' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '030', name: 'Heritage Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Kuda Microfinance Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '327', name: 'OPay Digital Services' },
  { code: '329', name: 'Paycom (Paycom)' },
  { code: '999', name: 'Rubies Microfinance Bank' },
  { code: '322', name: 'Titan Trust Bank' },
  { code: '090', name: 'Suntrust Bank' },
  { code: '305', name: 'Jaiz Bank' },
  { code: '560', name: 'Page Microfinance Bank' },
  { code: '512', name: 'Mint Finex Microfinance Bank' },
  { code: '503', name: 'Safe Trust Microfinance Bank' },
  { code: '501', name: 'Parallex Bank' },
  { code: '504', name: 'Moyofade Microfinance Bank' },
  { code: '326', name: 'Mkobo Microfinance Bank' },
  { code: '403', name: 'Jubilee Life Mortgage Bank' },
  { code: '551', name: 'TCF MFB' },
  { code: '552', name: 'NPF MFB' },
  { code: '507', name: 'Zeniex MFB' },
  { code: '800', name: 'CEMCS Microfinance Bank' },
  { code: '811', name: 'Cosmopolitan MFB' },
  { code: '328', name: 'One Finance MFB' },
  { code: '308', name: 'FinaTrust MFB' },
  { code: '508', name: 'Xslnce MFB' },
  { code: '509', name: 'Regent MFB' },
  { code: '513', name: 'Accion MFB' },
  { code: '514', name: 'Boi MFB' },
  { code: '515', name: 'Emerald MFB' },
  { code: '520', name: 'Lapo MFB' },
  { code: '521', name: 'Hasal MFB' },
  { code: '523', name: 'Mutual Trust MFB' },
  { code: '524', name: 'Nnew MFB' },
  { code: '525', name: 'RenMoney MFB' },
  { code: '530', name: 'AMML MFB' },
  { code: '531', name: 'Adeyemi College MFB' },
  { code: '532', name: 'Alheri MFB' },
  { code: '533', name: 'Amana MFB' },
  { code: '534', name: 'Anambra MFB' },
  { code: '535', name: 'Apostolic MFB' },
  { code: '536', name: 'Bakassi MFB' },
  { code: '537', name: 'Bauchi MFB' },
  { code: '538', name: 'Biu MFB' },
  { code: '539', name: 'Bosak MFB' },
  { code: '540', name: 'Chukwuemeka MFB' },
  { code: '541', name: 'Citizens Trust MFB' },
  { code: '542', name: 'Community MFB' },
  { code: '543', name: 'Consolidated MFB' },
  { code: '544', name: 'Contec MFB' },
  { code: '545', name: 'Covenant MFB' },
  { code: '546', name: 'Crescent MFB' },
  { code: '547', name: 'Daddo MFB' },
  { code: '548', name: 'Dalex MFB' },
  { code: '549', name: 'Dasmen MFB' },
  { code: '550', name: 'Daylight MFB' },
  { code: '553', name: 'Ogui MFB' },
  { code: '554', name: 'Ojokoro MFB' },
  { code: '555', name: 'Olofin MFB' },
  { code: '556', name: 'Owerri MFB' },
  { code: '557', name: 'Palmgrove MFB' },
  { code: '558', name: 'Pasali MFB' },
  { code: '559', name: 'Peace MFB' },
  { code: '561', name: 'Pennywise MFB' },
  { code: '563', name: 'Royal Exchange MFB' },
  { code: '564', name: 'Safana MFB' },
  { code: '565', name: 'Sagamu MFB' },
  { code: '566', name: 'Shalom MFB' },
  { code: '567', name: 'Shongom MFB' },
  { code: '568', name: 'Silhouette MFB' },
  { code: '569', name: 'Spectrum MFB' },
  { code: '570', name: 'St. Paul MFB' },
  { code: '571', name: 'Suleja MFB' },
  { code: '572', name: 'Takum MFB' },
  { code: '573', name: 'Taltit MFB' },
  { code: '574', name: 'Tara MFB' },
  { code: '575', name: 'Tau MFB' },
  { code: '576', name: 'Tiga MFB' },
  { code: '577', name: 'Triumph MFB' },
  { code: '578', name: 'U & C MFB' },
  { code: '579', name: 'U D MFB' },
  { code: '580', name: 'Ugba MFB' },
  { code: '581', name: 'Umuahia MFB' },
  { code: '582', name: 'Unity MFB' },
  { code: '583', name: 'Viky MFB' },
  { code: '584', name: 'Vina MFB' },
  { code: '585', name: 'Wac MFB' },
  { code: '586', name: 'Waya MFB' },
  { code: '587', name: 'Wema MFB' },
  { code: '588', name: 'Yobe MFB' },
  { code: '589', name: 'Yola MFB' },
  { code: '590', name: 'Zag MFB' },
  { code: '591', name: 'Zaria MFB' },
  { code: '592', name: 'Zenith MFB' },
  { code: '593', name: 'Zuma MFB' },
];

const Toggle = ({ on, onClick }) => (
  <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick}>
    <span className="toggle-knob" />
  </button>
);

const SettingRow = ({ iconName, label, sub, children, onClick }) => (
  <div className={`set-row ${onClick ? 'set-row-clickable' : ''}`} onClick={onClick}>
    {iconName && <span className="set-icon"><Icon name={iconName} size={20} /></span>}
    <div className="set-text">
      <div className="set-label">{label}</div>
      {sub && <div className="set-sub">{sub}</div>}
    </div>
    {children}
  </div>
);

const SectionCard = ({ title, children }) => (
  <div className="card">
    {title && <div className="set-section-title">{title}</div>}
    {children}
  </div>
);

export default function Settings({ user, onLogout, theme, onToggleTheme }) {
  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false); // driver only
  const [language, setLanguage] = useState('English');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [subPage, setSubPage] = useState(null); // 'terms' | 'privacy' | 'help' | null

  // Rate muve modal state
  const [showRate, setShowRate] = useState(false);
  const [rateStars, setRateStars] = useState(5);
  const [rateMsg, setRateMsg] = useState('');
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [rateToast, setRateToast] = useState('');

  // Bank account state
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankToast, setBankToast] = useState('');

  const isDriver = user.role === 'driver';

  const submitRate = async () => {
    setRateSubmitting(true);
    try {
      await submitFeedback(rateStars, rateMsg);
      setShowRate(false);
      setRateMsg('');
      setRateStars(5);
      setRateToast('Thanks for your feedback!');
      setTimeout(() => setRateToast(''), 3500);
    } catch (e) {
      setRateToast(e.message || 'Could not submit feedback');
      setTimeout(() => setRateToast(''), 3500);
    } finally {
      setRateSubmitting(false);
    }
  };

  const loadBankAccounts = () => {
    getBankAccount().then((d) => setBankAccounts(d.bankAccounts || [])).catch(() => setBankAccounts([]));
  };

  useEffect(() => {
    if (isDriver) loadBankAccounts();
  }, [isDriver]);

  const handleSaveBank = async () => {
    if (!bankCode) { setBankToast('Select your bank'); setTimeout(() => setBankToast(''), 2500); return; }
    if (!accountName.trim()) { setBankToast('Enter account name'); setTimeout(() => setBankToast(''), 2500); return; }
    if (accountNumber.length !== 10) { setBankToast('Enter a valid 10-digit account number'); setTimeout(() => setBankToast(''), 2500); return; }
    if (bankAccounts.length >= 3) { setBankToast('Maximum of 3 bank accounts allowed'); setTimeout(() => setBankToast(''), 2500); return; }
    setSavingBank(true);
    try {
      const bank = NIGERIAN_BANKS.find((b) => b.code === bankCode);
      await saveBankAccount(bankCode, bank?.name || '', accountNumber, accountName.trim());
      setBankToast('Bank account saved');
      setTimeout(() => setBankToast(''), 2500);
      setBankCode(''); setAccountName(''); setAccountNumber('');
      loadBankAccounts();
    } catch (e) {
      setBankToast(e.message || 'Could not save');
      setTimeout(() => setBankToast(''), 2500);
    } finally {
      setSavingBank(false);
    }
  };

  const handleDeleteBank = async (id) => {
    try {
      await deleteBankAccount(id);
      loadBankAccounts();
    } catch { /* ignore */ }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Settings</h2>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="settings-grid">
        {/* Preferences */}
        <SectionCard title="Preferences">
          <SettingRow iconName="bell" label="Notifications" sub="Ride updates, driver arrivals, promos">
            <Toggle on={notifications} onClick={() => setNotifications(!notifications)} />
          </SettingRow>
          <SettingRow iconName="pin" label="Location sharing" sub="Allow muve to use your location">
            <Toggle on={locationSharing} onClick={() => setLocationSharing(!locationSharing)} />
          </SettingRow>
          <SettingRow iconName="globe" label="Language">
            <select className="set-select" style={{ width: 'auto', minWidth: 120 }} value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option>English</option>
              <option>Pidgin</option>
              <option>Yoruba</option>
              <option>Hausa</option>
              <option>Igbo</option>
            </select>
          </SettingRow>
          <SettingRow iconName="ruler" label="Distance unit">
            <select className="set-select" style={{ width: 'auto', minWidth: 120 }} value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
              <option value="km">Kilometers</option>
              <option value="mi">Miles</option>
            </select>
          </SettingRow>
        </SectionCard>

        {/* About */}
        <SectionCard title="About">
          <SettingRow iconName="star" label="Rate muve" sub="Help us improve with a review" onClick={() => setShowRate(true)} />
          <SettingRow iconName="file" label="Terms of service" onClick={() => setSubPage('terms')} />
          <SettingRow iconName="lock" label="Privacy policy" onClick={() => setSubPage('privacy')} />
          <SettingRow iconName="help" label="Help & support" sub="FAQs, contact us" onClick={() => setSubPage('help')} />
        </SectionCard>
      </div>

      {/* Driver-specific settings
      {isDriver && (
        <SectionCard title="Driver preferences">
          <SettingRow iconName="zap" label="Auto-accept rides" sub={<>Automatically accept ride offers within <span className="num">1km</span></>}>
            <Toggle on={autoAccept} onClick={() => setAutoAccept(!autoAccept)} />
          </SettingRow>
        </SectionCard>
      )} */}

      {/* Driver bank account for withdrawals */}
      {isDriver && (
        <SectionCard title="Bank account">
          <div className="bank-acct-grid">
            {/* Form on left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="set-label">Bank</div>
              <select className="set-select" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
                <option value="">Select bank</option>
                {NIGERIAN_BANKS.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
              </select>
              <div className="set-label">Account name</div>
              <input
                className="set-input"
                type="text"
                placeholder="e.g. John Doe"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
              <div className="set-label">Account number</div>
              <input
                className="set-input num"
                type="text"
                inputMode="numeric"
                placeholder="10-digit account number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d]/g, ''))}
                maxLength={10}
              />
              {bankToast && <div className="muted" style={{ color: bankToast.includes('saved') ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{bankToast}</div>}
              <button className="btn btn-dark btn-block" onClick={handleSaveBank} disabled={savingBank || bankAccounts.length >= 3}>
                {savingBank ? 'Saving…' : 'Add bank account'}
              </button>
              {bankAccounts.length >= 3 && <div className="muted" style={{ fontSize: 13, textAlign: 'center' }}>Maximum of 3 accounts reached.</div>}
            </div>

            {/* Saved accounts on right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="set-label">Saved accounts ({bankAccounts.length}/3)</div>
              {bankAccounts.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No bank accounts saved yet.</div>}
              {bankAccounts.map((a) => (
                <div key={a.id} className="saved-bank-card">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{a.bankName}</div>
                    <div className="num" style={{ fontSize: 13 }}>{a.accountNumber}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{a.accountName}</div>
                  </div>
                  <button className="expense-del" onClick={() => handleDeleteBank(a.id)} title="Remove">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Rider-specific settings */}
      {!isDriver && (
        <SectionCard title="Ride preferences">
          <SettingRow iconName="car" label="Default ride tier" sub="Pre-selected when requesting">
            <select className="set-select" style={{ width: 'auto', minWidth: 120 }}>
              <option>MuveX</option>
              <option>MuveXL</option>
              <option>Muve Black</option>
            </select>
          </SettingRow>
        </SectionCard>
      )}

      {/* Logout */}
      <button className="btn btn-light btn-block btn-red" style={{ background: 'rgba(214,50,62,.12)', color: 'var(--red)', border: 'none' }} onClick={onLogout}>
        Log out
      </button>
      <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>muve <span className="num">v1.0</span> — Built for Nigeria</p>

      {/* Slide-in legal panel */}
      <div className={`legal-overlay ${subPage ? 'open' : ''}`} onClick={() => setSubPage(null)} />
      <div className={`legal-panel ${subPage ? 'open' : ''}`}>
        {subPage === 'terms' && <TermsPage onBack={() => setSubPage(null)} />}
        {subPage === 'privacy' && <PrivacyPage onBack={() => setSubPage(null)} />}
        {subPage === 'help' && <HelpPage onBack={() => setSubPage(null)} />}
      </div>

      {rateToast && <div className="toast">{rateToast}</div>}

      {/* Rate muve modal */}
      {showRate && (
        <div className="modal-overlay" onClick={() => setShowRate(false)}>
          <div className="save-modal" onClick={(e) => e.stopPropagation()}>
            <div className="save-modal-title">Rate muve</div>
            <div className="rate-stars" style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '12px 0' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRateStars(s)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, color: s <= rateStars ? '#f5a623' : 'var(--line)' }}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              className="save-modal-input"
              placeholder="Tell us what you think (optional)"
              value={rateMsg}
              onChange={(e) => setRateMsg(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'none', marginBottom: 12, fontFamily: 'inherit', fontSize: 14 }}
            />
            <div className="save-modal-actions">
              <button className="btn btn-light" onClick={() => { setShowRate(false); setRateMsg(''); setRateStars(5); }}>Cancel</button>
              <button className="btn btn-dark" onClick={submitRate} disabled={rateSubmitting}>{rateSubmitting ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
