import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Earnings() {
  return (
    <FeatureSection
      //num="09"
      eyebrow="Built for drivers"
      eyebrowColor="#0E8345"
      title={<>Track every <span className="highlight-green">Naira.</span></>}
      body="Income and expenses in one dashboard. Fuel, repairs and maintenance. Log it all and see your earnings in real time."
      tags={['Income tracking', 'Expense tracking']}
      cta="Start driving"
      image="09-earnings.webp"
      reverse
    />
  );
}
