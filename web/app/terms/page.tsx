import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | TrekRiderz",
  description: "TrekRiderz Terms of Service — the rules and conditions for using our platform.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-6 md:p-8">
      <h2 className="font-display text-2xl text-accent mb-4">{title}</h2>
      <div className="prose-policy">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <>
      <style>{`
        .prose-policy p { color: rgba(255,255,255,0.65); font-size: 0.9375rem; line-height: 1.75; margin-bottom: 0.85rem; }
        .prose-policy ul { color: rgba(255,255,255,0.6); font-size: 0.9375rem; line-height: 1.7; padding-left: 1.5rem; margin-bottom: 0.85rem; list-style-type: disc; }
        .prose-policy li { margin-bottom: 0.3rem; }
        .prose-policy strong { color: rgba(255,255,255,0.85); font-weight: 600; }
        .prose-policy a { color: #ADFF2F; text-decoration: underline; text-underline-offset: 3px; }
      `}</style>

      <div className="pt-32 pb-20 px-5 md:px-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-accent text-xs uppercase tracking-widest font-semibold mb-3">Legal</p>
          <h1 className="font-display text-5xl md:text-7xl text-white mb-3">TERMS OF SERVICE</h1>
          <p className="text-white/30 text-sm">Last updated: June 7, 2025 · NTRJ WEBDEV PVT LTD</p>
        </div>

        {/* TOC */}
        <div className="glass rounded-2xl p-6 mb-8">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Contents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              "1. Acceptance of Terms",
              "2. Eligibility",
              "3. User Accounts",
              "4. Trekking Safety Disclaimer",
              "5. User Content",
              "6. Payments and Bookings",
              "7. Cancellation & Refund Policy",
              "8. Prohibited Activities",
              "9. Intellectual Property",
              "10. Disclaimers",
              "11. Limitation of Liability",
              "12. Indemnification",
              "13. Governing Law",
              "14. Contact Us",
            ].map((item) => (
              <p key={item} className="text-white/50 text-sm">{item}</p>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Section title="1. Acceptance of Terms">
            <p>By downloading, installing, or using the TrekRiderz application or website ("Service"), you agree to be bound by these Terms of Service ("Terms"). These Terms constitute a legally binding agreement between you and NTRJ WEBDEV PVT LTD ("Company", "we", "us", or "our").</p>
            <p>If you do not agree to these Terms, please do not use our Service. We reserve the right to modify these Terms at any time, and your continued use of the Service constitutes acceptance of any changes.</p>
          </Section>

          <Section title="2. Eligibility">
            <p>You must be at least 13 years of age to use TrekRiderz. By using the Service, you represent and warrant that:</p>
            <ul>
              <li>You are at least 13 years of age</li>
              <li>You have the legal capacity to enter into these Terms</li>
              <li>You will comply with all applicable laws and regulations</li>
              <li>All information you provide is accurate and complete</li>
            </ul>
            <p>Users under 18 must have parental or guardian consent to participate in any trekking or outdoor activities organised through the platform.</p>
          </Section>

          <Section title="3. User Accounts">
            <p>To access certain features, you must create an account. You are responsible for:</p>
            <ul>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorised use of your account at <a href="mailto:hello@trekriderz.com">hello@trekriderz.com</a></li>
              <li>Ensuring your account information is accurate and up to date</li>
            </ul>
            <p>We reserve the right to suspend or terminate accounts that violate these Terms without prior notice.</p>
          </Section>

          <Section title="4. Trekking Safety Disclaimer">
            <p><strong>PLEASE READ THIS SECTION CAREFULLY.</strong> Trekking and outdoor activities involve inherent risks including but not limited to:</p>
            <ul>
              <li>Physical injury, illness, or death</li>
              <li>Adverse and unpredictable weather conditions</li>
              <li>Wild animal encounters</li>
              <li>Getting lost or separated from groups</li>
              <li>Equipment failure</li>
              <li>Altitude sickness on high-altitude treks</li>
              <li>Natural disasters including landslides and flash floods</li>
            </ul>
            <p>TrekRiderz provides information and community features to help you plan treks, but we are <strong>NOT responsible</strong> for any accidents, injuries, losses, or damages that occur during any trekking activity. Trail information on our platform may not be current or accurate. Always:</p>
            <ul>
              <li>Check local conditions and weather before trekking</li>
              <li>Trek with experienced and verified guides when attempting difficult trails</li>
              <li>Carry appropriate safety equipment and supplies</li>
              <li>Inform someone of your trek plans and expected return</li>
              <li>Obtain necessary permits for protected areas and national parks</li>
              <li>Carry adequate travel/trek insurance</li>
            </ul>
            <p>By using TrekRiderz to plan or join treks, you voluntarily assume all risks associated with trekking activities and release NTRJ WEBDEV PVT LTD from any liability arising therefrom.</p>
          </Section>

          <Section title="5. User Content">
            <p>You retain ownership of content you post on TrekRiderz ("User Content"). By posting content, you grant us a non-exclusive, royalty-free, worldwide licence to use, display, and distribute your content in connection with operating the Service.</p>
            <p>You agree not to post content that:</p>
            <ul>
              <li>Is false, misleading, or deceptive</li>
              <li>Infringes any third party's intellectual property rights</li>
              <li>Contains hate speech, harassment, or discrimination</li>
              <li>Promotes illegal activities or dangerous behaviour</li>
              <li>Contains spam or unsolicited commercial messages</li>
              <li>Is obscene, vulgar, or sexually explicit</li>
              <li>Violates any person's privacy or publishes personal information without consent</li>
            </ul>
            <p>We reserve the right to remove any content that violates these Terms without notice.</p>
          </Section>

          <Section title="6. Payments and Bookings">
            <p>When booking treks, guided expeditions, homestays, or gear through TrekRiderz:</p>
            <ul>
              <li>Payments are processed securely through Razorpay</li>
              <li>All prices are in Indian Rupees (INR) unless otherwise stated</li>
              <li>A booking is confirmed only upon successful payment and written confirmation from us</li>
              <li>Prices are subject to change; the price displayed at time of booking is binding</li>
              <li>GST and other applicable taxes may be added at checkout</li>
              <li>For international tours, currency conversion rates may apply</li>
            </ul>
          </Section>

          <Section title="7. Cancellation & Refund Policy">
            <p>Cancellations must be made in writing to <a href="mailto:hello@trekriderz.com">hello@trekriderz.com</a> or via WhatsApp. Refund policy:</p>
            <ul>
              <li><strong>Cancellation 15+ days before departure:</strong> Full refund minus payment gateway charges</li>
              <li><strong>Cancellation 7–14 days before departure:</strong> 50% refund</li>
              <li><strong>Cancellation less than 7 days before departure:</strong> No refund</li>
              <li><strong>Cancellation by TrekRiderz</strong> (e.g. due to safety concerns, insufficient group size, natural calamity): Full refund or free rescheduling</li>
            </ul>
            <p>Refunds are processed within 7–10 business days to the original payment method. Website enquiry submissions are not bookings and carry no cancellation or refund obligations.</p>
          </Section>

          <Section title="8. Prohibited Activities">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose or in violation of any regulations</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Attempt to gain unauthorised access to any part of the Service</li>
              <li>Use automated tools (bots, scrapers) to access the Service without permission</li>
              <li>Interfere with the proper functioning of the Service</li>
              <li>Collect or store personal data of other users without their consent</li>
              <li>Post false reviews or mislead other users about trek conditions</li>
              <li>Conduct competing services or solicit users off-platform</li>
            </ul>
          </Section>

          <Section title="9. Intellectual Property">
            <p>All content on TrekRiderz — including text, graphics, logos, images, audio clips, and software — is the property of NTRJ WEBDEV PVT LTD or its content suppliers and is protected by Indian and international intellectual property laws.</p>
            <p>You may not reproduce, distribute, modify, create derivative works of, publicly display, or exploit any content from the Service without our express written permission.</p>
          </Section>

          <Section title="10. Disclaimers">
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, NTRJ WEBDEV PVT LTD DISCLAIMS ALL WARRANTIES INCLUDING:</p>
            <ul>
              <li>Accuracy or completeness of trail information, guide profiles, or homestay listings</li>
              <li>Fitness for a particular purpose</li>
              <li>Non-infringement of third-party rights</li>
              <li>Uninterrupted or error-free operation of the Service</li>
            </ul>
            <p>We do not endorse or verify the qualifications of guides or the standards of homestays listed on the platform beyond our published verification process. Users are encouraged to conduct their own due diligence.</p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>To the fullest extent permitted by applicable law, NTRJ WEBDEV PVT LTD shall not be liable for:</p>
            <ul>
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, data, goodwill, or other intangible losses</li>
              <li>Any personal injury or property damage arising from your use of the Service</li>
              <li>Any accidents or incidents during trekking activities</li>
              <li>Third-party conduct or content on the platform</li>
            </ul>
            <p>Our total liability to you for any claims arising from these Terms shall not exceed the amount you paid to us in the 3 months preceding the claim, or ₹1,000, whichever is greater.</p>
          </Section>

          <Section title="12. Indemnification">
            <p>You agree to indemnify and hold harmless NTRJ WEBDEV PVT LTD, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses (including legal fees) arising from:</p>
            <ul>
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your User Content</li>
              <li>Any trekking or outdoor activity you undertake based on information from the Service</li>
              <li>Your violation of any rights of another person or entity</li>
            </ul>
          </Section>

          <Section title="13. Governing Law">
            <p>These Terms are governed by the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts located in Bangalore, Karnataka, India.</p>
            <p>We encourage resolving disputes through direct communication first. Contact us at <a href="mailto:hello@trekriderz.com">hello@trekriderz.com</a> before initiating any legal proceedings.</p>
          </Section>

          <Section title="14. Contact Us">
            <p>If you have any questions about these Terms, please contact us:</p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:hello@trekriderz.com">hello@trekriderz.com</a></li>
              <li><strong>Company:</strong> NTRJ WEBDEV PVT LTD</li>
              <li><strong>Address:</strong> Karnataka, India</li>
              <li><strong>WhatsApp:</strong> <a href="https://wa.me/919999999999">+91 99999 99999</a></li>
            </ul>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-accent hover:underline">← Back to Home</Link>
          <Link href="/privacy" className="text-white/40 hover:text-white transition-colors">Privacy Policy →</Link>
        </div>
      </div>
    </>
  );
}
