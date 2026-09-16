import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Match() {
  return (
    <FeatureSection
      //num="04"
      eyebrow="Behind the scenes"
      eyebrowColor="#0E8345"
      title={<>The network <br></br>finds you a <span className="highlight-green">Driver</span>.</>}
      body="The matching engine offers your request to the nearest driver, until someone accepts in 30 seconds or less."
      //tags={['Nearest-driver', '30s accept timer', 'WebSocket live']}
      image="04-match.webp"
      textRight
    />
  );
}
