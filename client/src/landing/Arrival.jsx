import React from 'react';
import FeatureSection from './FeatureSection.jsx';

export default function Arrival() {
  return (
    <FeatureSection
      //num="08"
      eyebrow="You made it"
      eyebrowColor="#0E8345"
      title={<>Pull up. <span className="highlight-green">Make Payment</span>. Rate Driver. </>}
      body="Add a tip if you wish, rate your driver, and you're done. Pay securely with Paystack — card, bank transfer, or USSD. Every trip makes the network smarter."
      tags={['Ratings', 'Tips', 'Paystack payments']}
      image="08-arrival.webp"
      textRight
    />
  );
}
