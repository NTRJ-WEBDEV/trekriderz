import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import AnimatedStats from "@/components/AnimatedStats";
import TripCard, { Trip } from "@/components/TripCard";
import { BUSINESS_WA } from "@/lib/constants";

export const revalidate = 60;

const SAMPLE_TRIPS: Trip[] = [
  {
    id: "coorg-coffee-trail",
    name: "Coorg Coffee Trail Trek",
    type: "trek",
    country: "India",
    destination: "Coorg, Karnataka",
    duration_days: 3,
    price_inr: 4999,
    difficulty: "easy",
    special_tag: "Popular",
  },
  {
    id: "hampi-heritage",
    name: "Hampi Heritage Walk",
    type: "tour",
    country: "India",
    destination: "Hampi, Karnataka",
    duration_days: 2,
    price_inr: 3499,
    difficulty: "easy",
  },
  {
    id: "nepal-abc",
    name: "Nepal Annapurna Base Camp",
    type: "trek",
    country: "Nepal",
    destination: "Annapurna, Nepal",
    duration_days: 12,
    price_inr: 28999,
    difficulty: "challenging",
    special_tag: "International",
  },
];

const DESTINATIONS = [
  { country: "India", label: "India", emoji: "🇮🇳", desc: "Western Ghats & beyond" },
  { country: "Nepal", label: "Nepal", emoji: "🇳🇵", desc: "Himalayan treks" },
  { country: "Bhutan", label: "Bhutan", emoji: "🇧🇹", desc: "Kingdom of happiness" },
  { country: "Philippines", label: "Philippines", emoji: "🇵🇭", desc: "Islands & volcanos" },
  { country: "Indonesia", label: "Indonesia", emoji: "🇮🇩", desc: "Bali & beyond" },
  { country: "Cambodia", label: "Cambodia", emoji: "🇰🇭", desc: "Temple adventures" },
];

const YOUTUBE_SHORTS = [
  {
    id: "placeholder-1",
    title: "Western Ghats Trek Highlights",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  {
    id: "placeholder-2",
    title: "Nepal Base Camp Journey",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  {
    id: "placeholder-3",
    title: "Bhutan Kingdom Tour",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
  {
    id: "placeholder-4",
    title: "Coorg Coffee Trail",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
];

async function getFeaturedTrips(): Promise<Trip[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("trips")
      .select("id,name,type,country,destination,duration_days,price_inr,difficulty,special_tag,cover_image")
      .eq("status", "active")
      .limit(3);
    return (data && data.length > 0 ? data : SAMPLE_TRIPS) as Trip[];
  } catch {
    return SAMPLE_TRIPS;
  }
}

async function getYoutubeVideos() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("youtube_videos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(4);
    return data && data.length > 0 ? data : YOUTUBE_SHORTS;
  } catch {
    return YOUTUBE_SHORTS;
  }
}

export default async function Home() {
  const [trips, videos] = await Promise.all([getFeaturedTrips(), getYoutubeVideos()]);

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center px-5 pt-20 pb-12">
        <div className="text-center max-w-4xl mx-auto">
          <p className="text-accent text-xs md:text-sm uppercase tracking-[0.3em] mb-6 font-semibold">
            Western Ghats &amp; International Adventures
          </p>
          <h1 className="font-display text-[clamp(3rem,12vw,8rem)] text-white leading-none mb-4">
            YOUR ADVENTURE,
            <br />
            <span className="text-accent">OUR COMMUNITY</span>
          </h1>
          <p className="text-white/60 text-base md:text-xl mb-10 tracking-wide font-light">
            Trek. Travel. Connect.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/trips"
              className="btn-accent px-8 py-4 rounded-full font-bold text-sm md:text-base"
            >
              Explore Trips
            </Link>
            <Link
              href="/plan"
              className="btn-ghost px-8 py-4 rounded-full font-bold text-sm md:text-base backdrop-blur-sm"
            >
              Plan My Custom Trip
            </Link>
          </div>
          {/* Scroll hint */}
          <div className="mt-16 flex flex-col items-center gap-2 text-white/30 text-xs animate-bounce">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
            Scroll to explore
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <AnimatedStats />

      {/* ─── FEATURED TRIPS ─── */}
      <section className="py-20 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">
                Handpicked For You
              </p>
              <h2 className="font-display text-4xl md:text-6xl text-white">
                FEATURED TRIPS
              </h2>
            </div>
            <Link
              href="/trips"
              className="hidden md:inline-flex btn-ghost px-5 py-2.5 rounded-full text-sm font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
          <div className="text-center mt-8 md:hidden">
            <Link
              href="/trips"
              className="btn-accent px-8 py-3 rounded-full font-bold inline-block"
            >
              View All Trips
            </Link>
          </div>
        </div>
      </section>

      {/* ─── DESTINATIONS STRIP ─── */}
      <section className="py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">
            Where We Go
          </p>
          <h2 className="font-display text-4xl md:text-6xl text-white mb-10">
            DESTINATIONS
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {DESTINATIONS.map((d) => (
              <Link
                key={d.country}
                href={`/trips?country=${d.country}`}
                className="glass-card rounded-2xl p-5 text-center hover:border-accent/30 hover:-translate-y-1 transition-all duration-200 group"
              >
                <div className="text-4xl mb-3">{d.emoji}</div>
                <div className="font-bold text-white text-sm group-hover:text-accent transition-colors">
                  {d.label}
                </div>
                <div className="text-white/40 text-xs mt-1">{d.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SPECIAL PACKAGES ─── */}
      <section className="py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">
            Celebrate in the Wild
          </p>
          <h2 className="font-display text-4xl md:text-6xl text-white mb-10">
            SPECIAL PACKAGES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Birthday */}
            <div className="glass-card rounded-2xl overflow-hidden group">
              <div className="h-48 img-placeholder flex-col gap-2">
                <span className="text-4xl opacity-30">🎂</span>
                <span className="text-[10px]">📸 Birthday trip photo</span>
              </div>
              <div className="p-6">
                <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 rounded-full px-3 py-1 text-pink-400 text-xs font-bold mb-3">
                  🎉 Birthday Escapes
                </div>
                <h3 className="font-display text-3xl text-white mb-2">
                  BIRTHDAY TREK
                </h3>
                <p className="text-white/55 text-sm mb-4 leading-relaxed">
                  Celebrate your birthday on a mountain peak or a riverside
                  campsite. Custom decorations, surprise elements, bonfire &amp;
                  group memories guaranteed.
                </p>
                <p className="text-accent font-bold mb-4">
                  Starting ₹2,999/person
                </p>
                <Link
                  href="/special"
                  className="btn-accent px-6 py-2.5 rounded-full text-sm font-bold inline-block"
                >
                  Plan Birthday Trip
                </Link>
              </div>
            </div>

            {/* Anniversary */}
            <div className="glass-card rounded-2xl overflow-hidden group">
              <div className="h-48 img-placeholder flex-col gap-2">
                <span className="text-4xl opacity-30">💑</span>
                <span className="text-[10px]">📸 Anniversary trip photo</span>
              </div>
              <div className="p-6">
                <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-full px-3 py-1 text-rose-400 text-xs font-bold mb-3">
                  ❤️ Anniversary Trips
                </div>
                <h3 className="font-display text-3xl text-white mb-2">
                  ANNIVERSARY ESCAPE
                </h3>
                <p className="text-white/55 text-sm mb-4 leading-relaxed">
                  Romantic getaways to Coorg coffee estates, Munnar hillside
                  retreats, or a Goa beach sunrise. Private arrangements on
                  request.
                </p>
                <p className="text-accent font-bold mb-4">
                  Starting ₹5,999/couple
                </p>
                <Link
                  href="/special"
                  className="btn-accent px-6 py-2.5 rounded-full text-sm font-bold inline-block"
                >
                  Plan Anniversary Trip
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── YOUTUBE SHORTS ─── */}
      <section className="py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">
                Trail Reels
              </p>
              <h2 className="font-display text-4xl md:text-6xl text-white">
                WATCH THE ADVENTURE
              </h2>
            </div>
            <a
              href="https://youtube.com/@trekriderz"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex btn-ghost px-5 py-2.5 rounded-full text-sm font-medium"
            >
              Subscribe →
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {videos.map((v: { id: string; title: string; embedUrl?: string; embed_url?: string }) => (
              <div key={v.id} className="glass-card rounded-2xl overflow-hidden">
                <div className="relative aspect-[9/16]">
                  <iframe
                    src={v.embedUrl || v.embed_url}
                    title={v.title}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <p className="text-white/70 text-xs font-medium line-clamp-1">{v.title}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a
              href="https://youtube.com/@trekriderz"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent px-8 py-3 rounded-full font-bold inline-block"
            >
              Follow on YouTube →
            </a>
          </div>
        </div>
      </section>

      {/* ─── CUSTOM TRIP PLANNER TEASER ─── */}
      <section className="py-20 px-5 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass-accent rounded-3xl p-10 md:p-16">
            <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">
              Built For You
            </p>
            <h2 className="font-display text-5xl md:text-7xl text-white mb-4">
              CUSTOM TRIP PLANNER
            </h2>
            <p className="text-white/60 text-base md:text-lg mb-8 leading-relaxed">
              Tell us your budget, fitness level, and dream destination — we'll
              match you with the perfect trip or build one from scratch. Our team
              will WhatsApp you within 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/plan"
                className="btn-accent px-8 py-4 rounded-full font-bold text-base"
              >
                Plan My Custom Trip →
              </Link>
              <a
                href={`https://wa.me/${BUSINESS_WA}?text=Hi%2C%20I%27d%20like%20to%20plan%20a%20custom%20trip!`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost px-8 py-4 rounded-full font-bold text-base"
              >
                💬 WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
