import Link from "next/link";

export const metadata = {
  title: "About | TrekRiderz — Our Story",
  description:
    "TrekRiderz is a founder-led community trekking company from Karnataka. Western Ghats roots, international reach — Nepal, Bhutan, Philippines, Indonesia, Cambodia.",
};

const PARTNERS = [
  { country: "Nepal", flag: "🇳🇵", desc: "Himalayan guide networks" },
  { country: "Bhutan", flag: "🇧🇹", desc: "Licensed cultural tour operators" },
  { country: "Philippines", flag: "🇵🇭", desc: "Island adventure specialists" },
  { country: "Indonesia", flag: "🇮🇩", desc: "Bali & Lombok local experts" },
  { country: "Cambodia", flag: "🇰🇭", desc: "Heritage trek coordinators" },
];

const VALUES = [
  { icon: "⛰️", title: "Community First", desc: "We trek together. Every trip is a chance to build friendships, not just check destinations." },
  { icon: "🌿", title: "Responsible Travel", desc: "Leave no trace. Support local homestays. Pay fair wages to local guides." },
  { icon: "🧭", title: "Expert Curation", desc: "Every route is scouted by our team. We don't list trips we haven't personally done." },
  { icon: "🤝", title: "Always Reachable", desc: "Our team is on WhatsApp 7 days a week. No call centres — real people, real answers." },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <div className="pt-32 pb-16 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">
          Our Story
        </p>
        <h1 className="font-display text-5xl md:text-8xl text-white leading-none mb-6">
          TREK.<br />
          <span className="text-accent">TRAVEL.</span><br />
          CONNECT.
        </h1>
        <p className="text-white/55 text-base md:text-lg max-w-xl mx-auto">
          India's community-led trekking company. Born in the Western Ghats,
          now taking adventurers across the world.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 pb-24 space-y-16">
        {/* Story */}
        <section className="glass-card rounded-3xl p-8 md:p-12">
          <h2 className="font-display text-4xl text-white mb-6">HOW IT STARTED</h2>
          <div className="space-y-4 text-white/65 text-base leading-relaxed">
            <p>
              TrekRiderz was born from a simple frustration: great trails existed across
              the Western Ghats, but finding reliable, community-led trips to them was
              nearly impossible. Most operators ran cookie-cutter packages with no soul.
            </p>
            <p>
              We started with weekend treks from Bangalore — Kudremukh, Kodachadri,
              Kumara Parvatha. Word spread through WhatsApp groups. People showed up.
              Communities formed. The company grew organically from those connections.
            </p>
            <p>
              Today, TrekRiderz operates treks and tours across India and six countries —
              but the philosophy hasn't changed. Every trip is community-first, every
              guide is locally sourced, every itinerary is personally tested.
            </p>
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="font-display text-4xl text-white mb-8">WHAT WE BELIEVE</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {VALUES.map((v) => (
              <div key={v.title} className="glass-card rounded-2xl p-6 hover:border-accent/20 transition-all">
                <div className="text-3xl mb-3">{v.icon}</div>
                <h3 className="font-bold text-white text-base mb-2">{v.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* International Partners */}
        <section>
          <h2 className="font-display text-4xl text-white mb-2">INTERNATIONAL PARTNERS</h2>
          <p className="text-white/50 text-sm mb-8">
            Verified local operators and guide networks across five countries.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {PARTNERS.map((p) => (
              <div key={p.country} className="glass-card rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">{p.flag}</div>
                <div className="font-bold text-white text-sm mb-1">{p.country}</div>
                <div className="text-white/40 text-xs">{p.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Team placeholder */}
        <section>
          <h2 className="font-display text-4xl text-white mb-8">THE TEAM</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Founder & Head Guide", "Operations Lead", "International Tours", "Community Manager"].map((role, i) => (
              <div key={role} className="glass-card rounded-2xl p-5 text-center">
                <div className="w-16 h-16 rounded-full img-placeholder mx-auto mb-3">
                  <span className="text-xs text-center" style={{ fontSize: "9px" }}>
                    📸 Photo {i + 1}
                  </span>
                </div>
                <div className="text-white/70 text-xs">{role}</div>
              </div>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-4 text-center">
            Team photos placeholder — drop real photos in web/public/images/team/
          </p>
        </section>

        {/* CTA */}
        <div className="glass-accent rounded-3xl p-10 text-center">
          <h2 className="font-display text-4xl text-white mb-3">LET'S TREK TOGETHER</h2>
          <p className="text-white/55 text-sm mb-6">
            Whether you're a first-time hiker or a seasoned summit-chaser, there's a
            TrekRiderz adventure waiting for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/trips" className="btn-accent px-8 py-3 rounded-full font-bold">
              Browse Trips
            </Link>
            <Link href="/plan" className="btn-ghost px-8 py-3 rounded-full font-bold">
              Plan Custom Trip
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
