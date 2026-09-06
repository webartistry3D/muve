import React, { useState, useEffect } from 'react';
import { getUser, clearSession } from './api.js';
import { resetSocket } from './socket.js';
import AuthPage from './AuthPage.jsx';
import RiderHome from './RiderHome.jsx';
import DriverHome from './DriverHome.jsx';
import History from './History.jsx';
import Earnings from './Earnings.jsx';
import Profile from './Profile.jsx';
import Settings from './Settings.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Icon from './Icons.jsx';

export default function App() {
  const [user, setUser] = useState(getUser());
  const [tab, setTab] = useState('home');
  const [theme, setTheme] = useState(() => localStorage.getItem('muve-theme') || 'light');
  const [installEvent, setInstallEvent] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [paymentVersion, setPaymentVersion] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('muve-theme', theme);
  }, [theme]);

  useEffect(() => {
    const dismissed = localStorage.getItem('muve-install-dismissed');
    if (dismissed) return;
    const handler = (e) => {
      e.preventDefault();
      setInstallEvent(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setInstallEvent(null);
      setShowInstall(false);
      localStorage.setItem('muve-install-dismissed', '1');
    }
  };

  const dismissInstall = () => {
    setShowInstall(false);
    localStorage.setItem('muve-install-dismissed', '1');
  };

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  if (!user) return (
    <>
      {showInstall && (
        <div className="install-banner">
          <div className="install-banner__text">
            <strong>Install muve</strong>
            <span>Add to your home screen for quick access</span>
          </div>
          <button className="install-banner__btn" onClick={handleInstall}>Install</button>
          <button className="install-banner__close" onClick={dismissInstall}>×</button>
        </div>
      )}
      <AuthPage onAuth={setUser} />
    </>
  );

  const logout = () => {
    clearSession();
    resetSocket();
    setUser(null);
    setTab('home');
  };

  const isDriver = user.role === 'driver';
  const tabs = isDriver
    ? [ ['home', 'car', 'Drive'], ['activity', 'chart', 'Earnings'], ['account', 'user', 'Account'], ['settings', 'gear', 'Settings'] ]
    : [ ['home', 'car', 'Ride'], ['activity', 'clock', 'Activity'], ['account', 'user', 'Account'], ['settings', 'gear', 'Settings'] ];

  return (
    <div className="app">
      <div className="app-body">
        {/* Home stays mounted so an active ride keeps running while browsing tabs */}
        <div style={{ position: 'absolute', inset: 0, visibility: tab === 'home' ? 'visible' : 'hidden' }}>
          {isDriver ? <DriverHome user={user} theme={theme} onToggleTheme={toggleTheme} /> : <RiderHome user={user} theme={theme} onToggleTheme={toggleTheme} paymentVersion={paymentVersion} />}
        </div>
        {tab === 'activity' && (isDriver ? <Earnings /> : <History />)}
        {tab === 'account' && <Profile user={user} onLogout={logout} onPaymentUpdate={() => setPaymentVersion((v) => v + 1)} />}
        {tab === 'settings' && <Settings user={user} onLogout={logout} />}
      </div>
      <nav className="tabbar">
        {tabs.map(([key, iconName, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <span className="t-ico"><Icon name={iconName} size={33} /></span>
            <span className="t-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
