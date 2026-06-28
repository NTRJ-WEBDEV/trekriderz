import { BUSINESS_WA } from "@/lib/constants";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | TrekRiderz",
  description: "TrekRiderz Privacy Policy — how we collect, use, and protect your information.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-6 md:p-8">
      <h2 className="font-display text-2xl text-accent mb-4">{title}</h2>
      <div className="prose-policy">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
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
          <h1 className="font-display text-5xl md:text-7xl text-white mb-3">PRIVACY POLICY</h1>
          <p className="text-white/30 text-sm">Last updated: June 7, 2025 · NTRJ WEBDEV PVT LTD</p>
        </div>

        {/* TOC */}
        <div className="glass rounded-2xl p-6 mb-8">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Contents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              "1. Introduction",
              "2. Information We Collect",
              "3. How We Use Your Information",
              "4. Location Data",
              "5. Sharing Your Information",
              "6. Data Retention",
              "7. Data Security",
              "8. Your Rights",
              "9. Children's Privacy",
              "10. Changes to This Policy",
              "11. Contact Us",
            ].map((item) => (
              <p key={item} className="text-white/50 text-sm">{item}</p>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Section title="1. Introduction">
            <p>Welcome to TrekRiderz ("we", "our", or "us"). TrekRiderz is operated by NTRJ WEBDEV PVT LTD, a company incorporated in India. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website (collectively, the "Service").</p>
            <p>By using TrekRiderz, you agree to the collection and use of information in accordance with this policy. If you do not agree with any part of this policy, please do not use our Service.</p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong>Information you provide directly:</strong></p>
            <ul>
              <li>Name, email address, and profile photo when you register</li>
              <li>Phone number for account verification</li>
              <li>Trek preferences, fitness level, and experience information</li>
              <li>Photos, posts, and content you share on the platform</li>
              <li>Payment information for booking treks (processed securely via Razorpay)</li>
              <li>Communications you send to us or other users</li>
              <li>Enquiry and trip planning details submitted through our website forms</li>
            </ul>
            <p><strong>Information collected automatically:</strong></p>
            <ul>
              <li>Device information (model, operating system, unique identifiers)</li>
              <li>Location data (GPS coordinates, with your permission) for trail navigation and safety</li>
              <li>Usage data (pages visited, features used, time spent)</li>
              <li>Log data (IP address, browser type, crash reports)</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul>
              <li>Create and manage your account</li>
              <li>Provide, maintain, and improve our Service</li>
              <li>Enable you to discover trails and connect with other trekkers</li>
              <li>Process trek bookings and payments</li>
              <li>Respond to enquiries and custom trip planning requests</li>
              <li>Send safety alerts and important notifications</li>
              <li>Provide customer support</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Ensure platform safety and prevent fraud</li>
              <li>Comply with legal obligations</li>
              <li>Analyse usage patterns to improve user experience</li>
            </ul>
          </Section>

          <Section title="4. Location Data">
            <p>TrekRiderz requests access to your device's location for the following purposes:</p>
            <ul>
              <li><strong>Trail navigation:</strong> To show your position on trail maps</li>
              <li><strong>Safety tracking:</strong> To share your location with trek group members during active treks</li>
              <li><strong>Nearby trails:</strong> To show trekking routes near your current location</li>
            </ul>
            <p>Location access is optional. You can deny location permission and still use most features of the app. You can revoke location access at any time through your device settings.</p>
            <p>We do not share your precise location with third parties except when you explicitly enable live location sharing within the app with your trek group.</p>
          </Section>

          <Section title="5. Sharing Your Information">
            <p>We do not sell your personal information. We may share your information with:</p>
            <ul>
              <li><strong>Other users:</strong> Your profile, posts, and trek activities are visible to other TrekRiderz users as per your privacy settings</li>
              <li><strong>Service providers:</strong> Third-party vendors who help us operate the Service (cloud hosting, analytics, payment processing)</li>
              <li><strong>Trek organisers and guides:</strong> When you book a trek, your name and contact details are shared with the organiser</li>
              <li><strong>Homestay owners:</strong> When you book accommodation, relevant booking details are shared</li>
              <li><strong>Law enforcement:</strong> When required by law or to protect safety</li>
              <li><strong>Business transfers:</strong> In case of merger, acquisition, or sale of assets</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <p>We retain your personal data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting us at <a href="mailto:privacy@trekriderz.com">privacy@trekriderz.com</a>. We will delete your data within 30 days of your request, except where we are required to retain it by law.</p>
            <p>Website enquiry data (trip enquiries, custom plans) is retained for 2 years for business record purposes and then permanently deleted.</p>
          </Section>

          <Section title="7. Data Security">
            <p>We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. These include encryption in transit (HTTPS/TLS), secure cloud storage via Supabase (SOC 2 Type II certified), and access controls.</p>
            <p>However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.</p>
          </Section>

          <Section title="8. Your Rights">
            <p>Under applicable Indian data protection law, you have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data (subject to legal requirements)</li>
              <li><strong>Portability:</strong> Request your data in a structured, machine-readable format</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent for optional data processing at any time</li>
              <li><strong>Grievance redressal:</strong> Lodge a complaint with our grievance officer</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href="mailto:privacy@trekriderz.com">privacy@trekriderz.com</a>. We will respond within 30 days.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>TrekRiderz is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately and we will delete that information.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of the Service after changes are posted constitutes acceptance of the updated policy.</p>
            <p>For material changes, we will also send a notification via email or in-app notification.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:privacy@trekriderz.com">privacy@trekriderz.com</a></li>
              <li><strong>Company:</strong> NTRJ WEBDEV PVT LTD</li>
              <li><strong>Address:</strong> Karnataka, India</li>
              <li><strong>WhatsApp:</strong> <a href={`https://wa.me/${BUSINESS_WA}`}>+91 99999 99999</a></li>
            </ul>
            <p>We aim to respond to all privacy-related inquiries within 7 business days.</p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-accent hover:underline">← Back to Home</Link>
          <Link href="/terms" className="text-white/40 hover:text-white transition-colors">Terms of Service →</Link>
        </div>
      </div>
    </>
  );
}
