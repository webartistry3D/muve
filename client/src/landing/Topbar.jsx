import React from 'react';

export default function Topbar() {
  return (
    <nav className="topbar">
      <a href="#top" className="topbar__brand">
        <span className="topbar__brand-mark">m</span>
        muve
      </a>
      <div className="topbar__links">
        <a href="/about.html">About</a>
        <a href="/contact.html">Contact</a>
        <a href="/app" className="topbar__cta">Ride now</a>
      </div>
    </nav>
  );
}
