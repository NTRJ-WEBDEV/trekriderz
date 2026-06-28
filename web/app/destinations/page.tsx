import { BUSINESS_WA } from "@/lib/constants";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

export const metadata = {
  title: "Destinations | TrekRiderz — India to International",
  description:
    "Explore trekking and tour destinations — Western Ghats, Himalayan Nepal, Bhutan Kingdom, Philippines islands, Bali Indonesia, Cambodia heritage trails.",
};

const DESTINATIONS = [
  {
    country: "India",
    flag: "🇮🇳",
    tagline: "Where It All Began",
    description:
      "Western Ghats coffee forests, Himalayan foothills, coastal escapes, and heritage heartlands. India is our home trail — we know every switchback.",
    highlights: ["Western Ghats treks", "Coorg coffee estates", "Hampi heritage", "Monsoon trails"],
    color: "from-orange-900/40 to-transparent",
    accent: "text-orange-400",
    tripCount: null,
  },
  {
    country: "Nepal",
    flag: "🇳🇵",
    tagline: "Roof of the World",
    description:
      "Annapurna Base Camp, Everest Base Camp, Langtang Valley. Our Nepali guide network handles permits, tea houses, and acclimatisation so you just walk.",
    highlights: ["Annapurna Circuit", "EBC Trek", "Poon Hill sunrise", "Kathmandu cultural tour"],
    color: "from-blue-900/40 to-transparent",
    accent: "text-blue-400",
    tripCount: null,
  },
  {
    country: "Bhutan",
    flag: "🇧🇹",
    tagline: "Kingdom of Happiness",
    description:
      "Tiger's Nest Monastery, Punakha Dzong, and Himalayan valleys where measured tourism preserves the kingdom's soul. Limited groups, deep experience.",
    highlights: ["Tiger's Nest trek", "Punakha Dzong", "Black-neck crane valleys", "Archery experience"],
    color: "from-yellow-900/40 to-transparent",
    accent: "text-yellow-400",
    tripCount: null,
  },
  {
    country: "Philippines",
    flag: "🇵🇭",
    tagline: "Islands & Adventure",
    description:
      "Palawan's underground river, El Nido's hidden lagoons, Coron's WW2 wrecks. Southeast Asia's most dramatic island scenery — above and below water.",
    highlights: ["El Nido island hopping", "Underground River UNESCO", "Coron dive wrecks", "Secret beaches"],
    color: "from-cyan-900/40 to-transparent",
    accent: "text-cyan-400",
    tripCount: null,
  },
  {
    country: "Indonesia",
    flag: "🇮🇩",
    tagline: "Bali & Beyond",
    description:
      "Bali's terraced rice fields, Mount Bromo's volcanic dawn, Lombok's waterfalls. Indonesia packs infinite diversity into a single archipelago.",
    highlights: ["Bali cultural trek", "Mount Bromo sunrise", "Lombok waterfalls", "Komodo boat trip"],
    color: "from-green-900/40 to-transparent",
    accent: "text-green-400",
    tripCount: null,
  },
  {
    country: "Cambodia",
    flag: "🇰🇭",
    tagline: "Heritage Trail",
    description:
      "Angkor Wat at sunrise, jungle temple ruins, Mekong river villages. Cambodia pairs UNESCO history with genuine community-led travel.",
    highlights: ["Angkor Wat sunrise", "Ta Prohm jungle temple", "Mekong village stays", "Phnom Penh history"],
    color: "from-red-900/40 to-transparent",
    accent: "text-red-400",
    tripCount: null,
  },
];

async function getTripCountsByCountry() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("trips")
      .select("country")
      .eq("status", "active");
    if (!data) return {};
    const counts: Record<string, number> = {};
    data.forEach((t) => {
      counts[t.country] = (counts[t.country] || 0) + 1;
    });
    return counts;
  } catch {
    return {};
  }
}

export default async function DestinationsPage() {
  const counts = await getTripCountsByCountry();

  return (
    <>
      {/* Hero */}
      <div className="pt-32 pb-14 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">
          6 Countries · Infinite Trails
        </p>
        <h1 className="font-display text-5xl md:text-8xl text-white leading-none mb-4">
          DESTINATIONS
        </h1>
        <p className="text-white/55 text-base md:text-lg max-w-xl mx-auto">
          From the Western Ghats in your backyard to mountain kingdoms across
          Asia — every route personally scouted by the TrekRiderz team.
        </p>
      </div>

      {/* Destination cards */}
      <div className="max-w-7xl mx-auto px-5 md:px-8 pb-24 space-y-6">
        {DESTINATIONS.map((d, i) => {
          const tripCount = counts[d.country] || 0;
          return (
            <div
              key={d.country}
              className={`glass-card rounded-3xl overflow-hidden`}
            >
              <div className={`grid grid-cols-1 md:grid-cols-5 gap-0 ${i % 2 === 1 ? "md:[direction:rtl]" : ""}`}>
                {/* Image placeholder — left or right alternating */}
                <div className={`md:col-span-2 h-56 md:h-auto img-placeholder flex-col gap-2 min-h-[220px] ${i % 2 === 1 ? "md:[direction:ltr]" : ""}`}>
                  <span className="text-5xl opacity-25">{d.flag}</span>
                  <span className="text-[10px] opacity-50">📸 {d.country} trip photo</span>
                </div>

                {/* Content */}
                <div className={`md:col-span-3 p-6 md:p-10 flex flex-col justify-center ${i % 2 === 1 ? "md:[direction:ltr]" : ""}`}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-3xl">{d.flag}</span>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest ${d.accent}`}>
                        {d.tagline}
                      </p>
                      <h2 className="font-display text-4xl md:text-5xl text-white">
                        {d.country.toUpperCase()}
                      </h2>
                    </div>
                  </div>

                  <p className="text-white/60 text-sm md:text-base leading-relaxed my-4">
                    {d.description}
                  </p>

                  {/* Highlights */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {d.highlights.map((h) => (
                      <span
                        key={h}
                        className="text-xs px-3 py-1 rounded-full glass text-white/60"
                      >
                        ✦ {h}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <Link
                      href={`/trips?country=${d.country}`}
                      className="btn-accent px-6 py-2.5 rounded-full font-bold text-sm"
                    >
                      {tripCount > 0
                        ? `View ${tripCount} Trip${tripCount !== 1 ? "s" : ""} →`
                        : "Browse Trips →"}
                    </Link>
                    <a
                      href={`https://wa.me/${BUSINESS_WA}?text=Hi%2C%20I%27m%20interested%20in%20trips%20to%20${encodeURIComponent(d.country)}!`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/50 text-sm hover:text-accent transition-colors"
                    >
                      💬 Ask us
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24 text-center">
        <div className="glass-accent rounded-3xl p-10">
          <h2 className="font-display text-4xl text-white mb-3">
            DON'T SEE YOUR DREAM DESTINATION?
          </h2>
          <p className="text-white/55 text-sm mb-6">
            We're expanding every season. Tell us where you want to go and we'll
            build it.
          </p>
          <Link
            href="/plan"
            className="inline-block btn-accent px-8 py-3 rounded-full font-bold"
          >
            Plan Custom Trip →
          </Link>
        </div>
      </div>
    </>
  );
}
