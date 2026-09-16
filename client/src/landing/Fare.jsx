import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Fare() {
  return (
    <FeatureSection
      //num="07"
      eyebrow="Fair fares, negotiated"
      eyebrowColor="#0E8345"
      title={<>Propose. Counter. <span className="highlight-green">Agree.</span></>}
      body="Don't like the suggested fare? Propose your own. Drivers can counter, riders can accept or decline — transparent negotiation built in."
      tags={['Fare negotiation', 'No surprises']}
      image="07-fare.webp"
      reverse
    />
  );
}
