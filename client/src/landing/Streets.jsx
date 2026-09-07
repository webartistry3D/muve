import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Streets() {
  return (
    <FeatureSection
      //num="02"
      //eyebrow="Where you are"
      eyebrowColor="#0E8345"
      title={<>Go <span className="highlight-green">Anywhere.</span></>}
      body="Markets, offices, homes, and hotspots. Every corner of Lagos is within reach. Your pickup is just a tap away."
      tags={['Lagos-wide', 'Door-to-door']}
      //cta="Start riding"
      image="02-streets.webp"
    />
  );
}
