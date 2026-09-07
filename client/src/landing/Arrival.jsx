import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Arrival() {
  return (
    <FeatureSection
      //num="08"
      eyebrow="You made it"
      eyebrowColor="#0E8345"
      title={<>Pull up. Make <span className="highlight-green">Payment.</span> Rate. </>}
      body="Rate your driver, add a tip, and you're done. Pay securely with Paystack — card, bank transfer, or USSD. Every trip makes the network smarter."
      tags={['Ratings', 'Tips', 'Paystack payments']}
      image="08-arrival.webp"
      textRight
    />
  );
}
