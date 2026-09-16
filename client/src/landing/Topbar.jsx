import React from 'react';

const BASE = import.meta.env.BASE_URL;

export default function Topbar() {
  return (
    <nav className="topbar">
      <a href="#top" className="topbar__brand">
        <img src={`${BASE}logo.png`} alt="muve" className="topbar__logo" />
        <span className="topbar__brand-text">u v e</span>
      </a>
      <div className="topbar__links">
        <a href="/about.html">About</a>
        <a href="/contact.html">Contact</a>
        <a href="/app" className="topbar__cta">Ride now</a>
      </div>
    </nav>
  );
}
