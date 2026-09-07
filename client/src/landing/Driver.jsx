import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Driver() {
  return (
    <FeatureSection
      //num="05"
      //eyebrow="Supply meets demand"
      eyebrowColor="#0E8345"
      title={<>Your driver <span className="highlight-green">on the way.</span></>}
      body="Trusted, verified drivers on Lagos roads, GPS streaming to your map every second."
      tags={['1Hz GPS stream', 'KYC verified', 'Ratings & tips']}
      image="05-driver.webp"
      reverse
    />
  );
}
