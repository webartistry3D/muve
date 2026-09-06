import React, { useState } from 'react';
import Icon from './Icons.jsx';

export default function Settings({ user, onLogout }) {
  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false); // driver only
  const [language, setLanguage] = useState('English');
  const [distanceUnit, setDistanceUnit] = useState('km');

  const isDriver = user.role === 'driver';

  const Toggle = ({ on, onClick }) => (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="toggle-knob" />
    </button>
  );

  const SettingRow = ({ iconName, label, sub, children }) => (
    <div className="set-row">
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

  return (
    <div className="page">
      <h2>Settings</h2>

      {/* Preferences */}
      <SectionCard title="Preferences">
        <SettingRow iconName="bell" label="Notifications" sub="Ride updates, driver arrivals, promos">
          <Toggle on={notifications} onClick={() => setNotifications(!notifications)} />
        </SettingRow>
        <SettingRow iconName="pin" label="Location sharing" sub="Allow muve to use your location">
          <Toggle on={locationSharing} onClick={() => setLocationSharing(!locationSharing)} />
        </SettingRow>
        <SettingRow iconName="globe" label="Language">
          <select className="set-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option>English</option>
            <option>Pidgin</option>
            <option>Yoruba</option>
            <option>Hausa</option>
            <option>Igbo</option>
          </select>
        </SettingRow>
        <SettingRow iconName="ruler" label="Distance unit">
          <select className="set-select" value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
            <option value="km">Kilometers</option>
            <option value="mi">Miles</option>
          </select>
        </SettingRow>
      </SectionCard>

      {/* Driver-specific settings */}
      {isDriver && (
        <SectionCard title="Driver preferences">
          <SettingRow iconName="zap" label="Auto-accept rides" sub={<>Automatically accept ride offers within <span className="num">1km</span></>}>
            <Toggle on={autoAccept} onClick={() => setAutoAccept(!autoAccept)} />
          </SettingRow>
        </SectionCard>
      )}

      {/* Rider-specific settings */}
      {!isDriver && (
        <SectionCard title="Ride preferences">
          <SettingRow iconName="car" label="Default ride tier" sub="Pre-selected when requesting">
            <select className="set-select">
              <option>MuveX</option>
              <option>MuveXL</option>
              <option>Muve Black</option>
            </select>
          </SettingRow>
        </SectionCard>
      )}

      {/* About */}
      <SectionCard title="About">
        <SettingRow iconName="star" label="Rate muve" sub="Help us improve with a review" />
        <SettingRow iconName="file" label="Terms of service" />
        <SettingRow iconName="lock" label="Privacy policy" />
        <SettingRow iconName="help" label="Help & support" sub="FAQs, contact us" />
      </SectionCard>

      {/* Logout */}
      <button className="btn btn-light btn-block btn-red" style={{ background: 'rgba(214,50,62,.12)', color: 'var(--red)', border: 'none' }} onClick={onLogout}>
        Log out
      </button>
      <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>muve <span className="num">v1.0</span> — Built for Nigeria</p>
    </div>
  );
}
