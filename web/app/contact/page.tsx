import { getSiteSettings } from "@/lib/site-settings";
import Breadcrumbs from "@/components/Breadcrumbs";
import ContactForm from "@/components/ContactForm";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata = buildMetadata({
  title: "Contact Us",
  description: "Get in touch with TrekRiderz — WhatsApp, email, or send us a message directly.",
  path: "/contact",
});

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-32 pb-24">
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]} />

      <div className="text-center mb-14">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">Say Hello</p>
        <h1 className="font-display text-5xl md:text-7xl text-white mb-4">CONTACT US</h1>
        <p className="text-white/55 text-base max-w-xl mx-auto">Questions about a trip, a partnership, or just want to say hi? We reply fast on WhatsApp.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="glass-card rounded-2xl p-6 flex items-center gap-4 hover:border-accent/30 transition-colors">
            <span className="text-3xl">📱</span>
            <div>
              <p className="text-white font-semibold">WhatsApp</p>
              <p className="text-white/50 text-sm">Fastest way to reach us</p>
            </div>
          </a>
          <a href={`mailto:${settings.email}`} className="glass-card rounded-2xl p-6 flex items-center gap-4 hover:border-accent/30 transition-colors">
            <span className="text-3xl">✉️</span>
            <div>
              <p className="text-white font-semibold">{settings.email}</p>
              <p className="text-white/50 text-sm">For partnerships & press</p>
            </div>
          </a>
          <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
            <span className="text-3xl">📍</span>
            <div>
              <p className="text-white font-semibold">Karnataka, India</p>
              <p className="text-white/50 text-sm">Western Ghats HQ</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6 flex items-center gap-6">
            <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-accent transition-colors">Instagram</a>
            <a href={settings.youtube_url} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-accent transition-colors">YouTube</a>
          </div>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
