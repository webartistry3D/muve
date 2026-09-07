import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Request() {
  return (
    <FeatureSection
      //num="03"
      //eyebrow="Tap. Where to?"
      eyebrowColor="#0E8345"
      title={<>It starts with a <span className="highlight-green">Pin</span>.</>}
      body="Set your pickup, drop a destination, and the city starts listening. One tap is all it takes."
      tags={['Address search', 'Tap-to-set', 'Instant estimate']}
      //cta="Set your pin"
      image="03-request.webp"
      reverse
    />
  );
}
