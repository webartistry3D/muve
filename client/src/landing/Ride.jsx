import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Ride() {
  return (
    <FeatureSection
      //num="06"
      //eyebrow="Three ways to get there"
      eyebrowColor="#C5564A"
      title={<>MuveX. <span className="green-pill">XL.</span> <span className="black-pill">Black.</span></>}
      body="Affordable everyday rides, extra room for groups, or premium top drivers with built in Live estimates and fare negotiation."
      tags={['MuveX', 'MuveXL', 'Muve Black']}
      cta="Choose your tier"
      image="06-ride.webp"
      textRight
    />
  );
}
