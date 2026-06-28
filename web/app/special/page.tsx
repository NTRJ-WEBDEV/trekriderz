import { BUSINESS_WA } from "@/lib/constants";
import SpecialEnquiryForm from "@/components/SpecialEnquiryForm";

export const metadata = {
  title: "Special Packages | TrekRiderz — Birthday & Anniversary Trips",
  description:
    "Custom birthday escapes, anniversary retreats, and vacation stays across India. Celebrate in the wild with TrekRiderz.",
};

const BIRTHDAY_INCLUSIONS = [
  "Custom birthday decorations at campsite/hotel",
  "Bonfire & group celebration",
  "Cake & personalised touches",
  "Trek/tour guide",
  "Photography assistance",
  "Accommodation",
  "All meals",
];

const ANNIVERSARY_INCLUSIONS = [
  "Romantic room setup with flowers",
  "Candlelit dinner arrangement",
  "Couple-specific activities",
  "Private guide for couple treks",
  "Accommodation (deluxe preferred)",
  "All meals",
  "Photography session",
];

const VACATION_PACKAGES = [
  { name: "Coorg Plantation Stay", duration: "2N/3D", price: "₹3,999/person", emoji: "☕", desc: "Homestay amid coffee estates, forest walks, waterfalls." },
  { name: "Munnar Hill Retreat", duration: "2N/3D", price: "₹4,499/person", emoji: "🍃", desc: "Tea garden views, Eravikulam NP, cool weather escape." },
  { name: "Goa Sunrise Escape", duration: "3N/4D", price: "₹7,999/person", emoji: "🌅", desc: "Beach stays, water sports, sunset cruises." },
  { name: "Hampi Heritage Stay", duration: "2N/3D", price: "₹3,499/person", emoji: "🏛️", desc: "Ruins exploration, coracle ride, sunset at Hemakuta Hill." },
];

export default function SpecialPage() {
  return (
    <>
      {/* Hero */}
      <div className="pt-32 pb-12 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">
          Celebrate in the Wild
        </p>
        <h1 className="font-display text-5xl md:text-7xl text-white mb-4">
          SPECIAL PACKAGES
        </h1>
        <p className="text-white/55 text-base md:text-lg max-w-xl mx-auto">
          Birthday escapes, anniversary retreats, and vacation stays — made
          personal, made memorable.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 pb-24 space-y-20">
        {/* ─── Birthday ─── */}
        <section id="birthday">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-4xl">🎂</span>
            <div>
              <p className="text-accent text-xs uppercase tracking-widest font-semibold">
                For the Birthday Person
              </p>
              <h2 className="font-display text-5xl text-white">BIRTHDAY ESCAPES</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div className="glass-card rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&auto=format&fit=crop&q=80"
                  alt="Birthday celebration trek at sunrise"
                  className="w-full h-52 object-cover"
                  loading="lazy"
                />
              </div>
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-display text-3xl text-white mb-2">
                  CELEBRATE AT A PEAK
                </h3>
                <p className="text-white/60 text-sm leading-relaxed mb-5">
                  Imagine blowing out candles at sunrise on a mountain peak, or
                  around a bonfire by the riverside. We create personalised
                  birthday experiences for solo trekkers and large groups alike —
                  from Western Ghats hikes to beach escapes.
                </p>
                <p className="text-accent font-bold text-lg mb-1">
                  Starting ₹2,999 / person
                </p>
                <p className="text-white/40 text-xs">Group discounts available · Min 4 people</p>
                <div className="mt-5">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-3">What's included</p>
                  <ul className="space-y-2">
                    {BIRTHDAY_INCLUSIONS.map((item, i) => (
                      <li key={i} className="flex gap-2 text-white/70 text-sm">
                        <span className="text-accent mt-0.5">✦</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <SpecialEnquiryForm type="birthday" />
          </div>
        </section>

        {/* ─── Anniversary ─── */}
        <section id="anniversary">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-4xl">❤️</span>
            <div>
              <p className="text-accent text-xs uppercase tracking-widest font-semibold">
                For Couples
              </p>
              <h2 className="font-display text-5xl text-white">ANNIVERSARY TRIPS</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div className="glass-card rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop&q=80"
                  alt="Couple trekking together in the mountains"
                  className="w-full h-52 object-cover"
                  loading="lazy"
                />
              </div>
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-display text-3xl text-white mb-2">
                  ROMANCE IN THE WILD
                </h3>
                <p className="text-white/60 text-sm leading-relaxed mb-5">
                  From a moonlit trek in Coorg to a private beach sunset in Goa —
                  our anniversary packages blend adventure with romance. Tell us
                  your story, we'll set the scene.
                </p>
                <p className="text-accent font-bold text-lg mb-1">
                  Starting ₹5,999 / couple
                </p>
                <p className="text-white/40 text-xs">All arrangements personalised on request</p>
                <div className="mt-5">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-3">What's included</p>
                  <ul className="space-y-2">
                    {ANNIVERSARY_INCLUSIONS.map((item, i) => (
                      <li key={i} className="flex gap-2 text-white/70 text-sm">
                        <span className="text-accent mt-0.5">✦</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <SpecialEnquiryForm type="anniversary" />
          </div>
        </section>

        {/* ─── Vacation Stays ─── */}
        <section id="stays">
          <div className="mb-8">
            <p className="text-accent text-xs uppercase tracking-widest font-semibold mb-1">
              Short Breaks
            </p>
            <h2 className="font-display text-5xl text-white">VACATION STAYS</h2>
            <p className="text-white/50 text-sm mt-2">Curated short break packages across India</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {VACATION_PACKAGES.map((pkg) => (
              <div key={pkg.name} className="glass-card rounded-2xl p-5 hover:border-accent/20 transition-all hover:-translate-y-1">
                <div className="text-4xl mb-3">{pkg.emoji}</div>
                <h3 className="font-bold text-white text-base mb-1">{pkg.name}</h3>
                <p className="text-white/40 text-xs mb-3">{pkg.duration}</p>
                <p className="text-white/60 text-sm mb-4 leading-relaxed">{pkg.desc}</p>
                <p className="text-accent font-bold text-sm">{pkg.price}</p>
                <a
                  href={`https://wa.me/${BUSINESS_WA}?text=Hi%2C%20I%27m%20interested%20in%20${encodeURIComponent(pkg.name)}!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block text-center btn-ghost px-4 py-2 rounded-full text-xs font-bold"
                >
                  Enquire
                </a>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
