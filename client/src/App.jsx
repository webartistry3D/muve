import React, { useState } from 'react';
import { getUser, clearSession } from './api.js';
import { resetSocket } from './socket.js';
import AuthPage from './AuthPage.jsx';
import RiderHome from './RiderHome.jsx';
import DriverHome from './DriverHome.jsx';
import History from './History.jsx';
import Earnings from './Earnings.jsx';
import Profile from './Profile.jsx';

export default function App() {
  const [user, setUser] = useState(getUser());
  const [tab, setTab] = useState('home');

  if (!user) return <AuthPage onAuth={setUser} />;

  const logout = () => {
    clearSession();
    resetSocket();
    setUser(null);
    setTab('home');
  };

  const isDriver = user.role === 'driver';
  const tabs = isDriver
    ? [ ['home', '🚕', 'Drive'], ['activity', '💰', 'Earnings'], ['account', '👤', 'Account'] ]
    : [ ['home', '🚗', 'Ride'], ['activity', '🕘', 'Activity'], ['account', '👤', 'Account'] ];

  return (
    <div className="app">
      <div className="app-body">
        {/* Home stays mounted so an active ride keeps running while browsing tabs */}
        <div style={{ position: 'absolute', inset: 0, visibility: tab === 'home' ? 'visible' : 'hidden' }}>
          {isDriver ? <DriverHome user={user} /> : <RiderHome user={user} />}
        </div>
        {tab === 'activity' && (isDriver ? <Earnings /> : <History />)}
        {tab === 'account' && <Profile user={user} onLogout={logout} />}
      </div>
      <nav className="tabbar">
        {tabs.map(([key, ico, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <span className="t-ico">{ico}</span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
