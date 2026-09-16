import React from 'react';
import Topbar from './Topbar.jsx';
import Hero from './Hero.jsx';
import Streets from './Streets.jsx';
import Request from './Request.jsx';
import Match from './Match.jsx';
import Driver from './Driver.jsx';
import Ride from './Ride.jsx';
import Fare from './Fare.jsx';
import Arrival from './Arrival.jsx';
import Earnings from './Earnings.jsx';
import ClosingCTA from './ClosingCTA.jsx';

export default function Landing() {
  return (
    <>
      <Topbar />
      <Hero />
      <div className="features">
        <Streets />
        <Request />
        <Match />
        <Driver />
        <Ride />
        <Fare />
        <Arrival />
        <Earnings />
      </div>
      <ClosingCTA />
      <footer className="footer">
        <strong>M u v e</strong> — Built for Nigeria
      </footer>
    </>
  );
}
