import React from 'react';

// Shared layout for legal/info sub-pages opened from Settings
export function LegalPage({ title, onBack, children }) {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h2>{title}</h2>
        <button className="legal-close" onClick={onBack}>×</button>
      </div>
      <div className="legal-body">{children}</div>
    </div>
  );
}

export function TermsPage({ onBack }) {
  return (
    <LegalPage title="Terms of Service" onBack={onBack}>
      <p className="legal-updated">Last updated: September 2026</p>

      <h3>1. Acceptance of Terms</h3>
      <p>By using the muve app ("muve", "we", "us"), you agree to these Terms of Service. If you do not agree, do not use the app.</p>

      <h3>2. The Service</h3>
      <p>muve connects riders with independent drivers in Lagos, Nigeria. We facilitate ride requests, fare estimation, and payment processing. muve is not a transportation carrier — drivers are independent contractors.</p>

      <h3>3. User Accounts</h3>
      <p>You must provide accurate information when registering. You are responsible for keeping your account credentials secure. You must be at least 18 years old to use muve.</p>

      <h3>4. Rides & Fares</h3>
      <p>Fares are estimated based on distance, time, and tier selection. For MuveX, you may propose a custom fare; drivers may accept, decline, or counter. The final fare is confirmed when a driver accepts your request. Cancellation fees may apply.</p>

      <h3>5. Payments</h3>
      <p>Payments are processed through Paystack. By requesting a ride, you authorize us to charge the confirmed fare to your selected payment method. Drivers receive 90% of the total fare.</p>

      <h3>6. Conduct</h3>
      <p>You agree not to abuse, harass, or endanger drivers or other users. muve reserves the right to suspend accounts for violations of these terms.</p>

      <h3>7. Liability</h3>
      <p>muve acts as a platform connecting riders and drivers. We are not liable for the acts of drivers or third parties. Our liability is limited to the fare paid for the ride in question.</p>

      <h3>8. Modifications</h3>
      <p>We may update these terms from time to time. Continued use of muve after changes constitutes acceptance of the updated terms.</p>

      <h3>9. Governing Law</h3>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>

      <p className="legal-contact">Questions? Email <a href="mailto:support@muve.app">support@muve.app</a></p>
    </LegalPage>
  );
}

export function PrivacyPage({ onBack }) {
  return (
    <LegalPage title="Privacy Policy" onBack={onBack}>
      <p className="legal-updated">Last updated: September 2026</p>

      <h3>1. Information We Collect</h3>
      <p><strong>Account:</strong> Name, phone number, email, password (hashed).</p>
      <p><strong>Location:</strong> Your GPS location when the app is open, used to match you with nearby drivers and calculate fares.</p>
      <p><strong>Ride Data:</strong> Pickup, destination, fare, payment method, and ride history.</p>
      <p><strong>Device:</strong> App version, device type, and basic analytics.</p>

      <h3>2. How We Use Your Information</h3>
      <p>To provide ride-hailing services, process payments, verify identity, improve our service, and communicate with you about rides and promotions.</p>

      <h3>3. How We Share Your Information</h3>
      <p><strong>Drivers:</strong> Your name, pickup, and destination are shared with the assigned driver.</p>
      <p><strong>Paystack:</strong> Payment details are processed securely through Paystack. We do not store your card details.</p>
      <p><strong>Law Enforcement:</strong> We may disclose information when required by Nigerian law.</p>

      <h3>4. Data Retention</h3>
      <p>Ride history is retained for 12 months. Account data is retained while your account is active. You may request deletion at any time.</p>

      <h3>5. Your Rights</h3>
      <p>You may access, correct, or delete your personal data. To exercise these rights, email <a href="mailto:privacy@muve.app">privacy@muve.app</a>.</p>

      <h3>6. Security</h3>
      <p>We use industry-standard encryption and security practices. However, no system is perfectly secure.</p>

      <h3>7. Children's Privacy</h3>
      <p>muve is not intended for users under 18. We do not knowingly collect data from minors.</p>

      <h3>8. Changes</h3>
      <p>We may update this policy from time to time. We will notify you of significant changes through the app.</p>

      <p className="legal-contact">Questions? Email <a href="mailto:privacy@muve.app">privacy@muve.app</a></p>
    </LegalPage>
  );
}

export function HelpPage({ onBack }) {
  return (
    <LegalPage title="Help & Support" onBack={onBack}>
      <h3>Frequently Asked Questions</h3>

      <h4>How do I request a ride?</h4>
      <p>Tap the "Go" button, enter your pickup and destination, select a ride tier, and tap "Request". Nearby drivers will be notified.</p>

      <h4>Can I negotiate my fare?</h4>
      <p>Yes. On MuveX, tap "Propose your own fare" before requesting. Drivers may accept, decline, or counter your offer.</p>

      <h4>How is my fare calculated?</h4>
      <p>Fares are based on base rate, distance (per km), and time (per minute). Surge pricing may apply during high demand.</p>

      <h4>What payment methods are supported?</h4>
      <p>Card payments via Paystack and bank transfer. Cash is not currently supported.</p>

      <h4>How do I cancel a ride?</h4>
      <p>Tap "Cancel" on the ride screen. A ₦200 cancellation fee may apply if the driver has already accepted.</p>

      <h4>What if I left an item in a ride?</h4>
      <p>Contact us immediately with your ride details and we'll help coordinate with the driver.</p>

      <h4>How do I become a driver?</h4>
      <p>Sign up as a driver, complete KYC verification, and add your vehicle details. Once approved, you can start accepting rides.</p>

      <h3>Contact Us</h3>
      <p><strong>Email:</strong> <a href="mailto:support@muve.app">support@muve.app</a></p>
      <p><strong>Phone:</strong> +234 800 MUVE NG</p>
      <p><strong>Hours:</strong> Mon–Sun, 7:00 AM – 11:00 PM (WAT)</p>
    </LegalPage>
  );
}
