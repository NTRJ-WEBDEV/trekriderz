import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import AnimatedStats from "@/components/AnimatedStats";
import TripCard, { Trip } from "@/components/TripCard";
import GuideCard, { GuideCardData } from "@/components/GuideCard";
import HomestayCard, { HomestayCardData } from "@/components/HomestayCard";
import StoryCard, { StoryCardData } from "@/components/StoryCard";
import ReelCard, { ReelCardData } from "@/components/ReelCard";
import SectionHeader from "@/components/SectionHeader";
import SearchBar from "@/components/SearchBar";
import Newsletter from "@/components/Newsletter";
import CTASection from "@/components/CTASection";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 60;

const DESTINATIONS = [
  { country: "India", label: "India", emoji: "🇮🇳", desc: "Western Ghats & beyond" },
  { country: "Nepal", label: "Nepal", emoji: "🇳🇵", desc: "Himalayan treks" },
  { country: "Bhutan", label: "Bhutan", emoji: "🇧🇹", desc: "Kingdom of happiness" },
  { country: "Philippines", label: "Philippines", emoji: "🇵🇭", desc: "Islands & volcanos" },
  { country: "Indonesia", label: "Indonesia", emoji: "🇮🇩", desc: "Bali & beyond" },
  { country: "Cambodia", label: "Cambodia", emoji: "🇰🇭", desc: "Temple adventures" },
];

const YOUTUBE_SHORTS_FALLBACK = [
  { id: "placeholder-1", title: "Western Ghats Trek Highlights", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
];

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const TRIP_COLS = "id,title,trip_type,destination,start_date,end_date,price_usd,difficulty,is_featured,cover_photo_url";

async function getFeaturedTrips(): Promise<Trip[]> {
  const { data } = await db().from("trips").select(TRIP_COLS).eq("is_featured", true).eq("is_public", true).limit(3);
  return (data as Trip[]) || [];
}

async function getUpcomingTrips(): Promise<Trip[]> {
  const { data } = await db().from("trips").select(TRIP_COLS).eq("is_public", true).not("start_date", "is", null).gte("start_date", new Date().toISOString().split("T")[0]).order("start_date", { ascending: true }).limit(3);
  return (data as Trip[]) || [];
}

async function getFeaturedHomestays(): Promise<HomestayCardData[]> {
  const { data } = await db().from("properties").select("id, name, city, state, property_type, cover_photo_url").eq("status", "approved").eq("is_featured", true).limit(3);
  return (data as HomestayCardData[]) || [];
}

async function getFeaturedGuides(): Promise<GuideCardData[]> {
  const { data } = await db().from("guides").select("id, full_name, name, profile_photo_url, photo_url, location, rating, total_reviews, is_premium").eq("status", "approved").order("is_premium", { ascending: false }).order("rating", { ascending: false, nullsFirst: false }).limit(3);
  return (data as GuideCardData[]) || [];
}

async function getStories(): Promise<StoryCardData[]> {
  const { data } = await db().from("stories").select("id, title, slug, destination, cover_image_url, body, created_at").eq("status", "approved").order("is_featured", { ascending: false }).limit(3);
  return (data as StoryCardData[]) || [];
}

async function getReels(): Promise<ReelCardData[]> {
  const { data } = await db().from("posts").select("id, content, media, likes_count, users(full_name)").eq("post_type", "reel").eq("visibility", "public").order("likes_count", { ascending: false }).limit(6);
  return ((data as any[]) || []).map((r) => ({ ...r, authorName: r.users?.full_name }));
}

async function getYoutubeVideos() {
  const { data } = await db().from("youtube_videos").select("*").order("order_index", { ascending: true }).limit(8);
  return data && data.length > 0 ? data : YOUTUBE_SHORTS_FALLBACK;
}

export default async function Home() {
  const [featuredTrips, upcomingTrips, homestays, guides, stories, reels, videos, settings] = await Promise.all([
    getFeaturedTrips(),
    getUpcomingTrips(),
    getFeaturedHomestays(),
    getFeaturedGuides(),
    getStories(),
    getReels(),
    getYoutubeVideos(),
    getSiteSettings(),
  ]);

  const waNumber = settings.whatsapp_number;

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center px-5 pt-20 pb-12">
        <div className="text-center max-w-4xl mx-auto w-full">
          <p className="text-accent text-xs md:text-sm uppercase tracking-[0.3em] mb-6 font-semibold">
            Western Ghats &amp; International Adventures
          </p>
          <h1 className="font-display text-[clamp(3rem,12vw,8rem)] text-white leading-none mb-4">
            YOUR ADVENTURE,
            <br />
            <span className="text-accent">OUR COMMUNITY</span>
          </h1>
          <p className="text-white/60 text-base md:text-xl mb-8 tracking-wide font-light">
            Trek. Travel. Connect.
          </p>

          <div className="max-w-xl mx-auto mb-8">
            <SearchBar />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/trips" className="btn-accent px-8 py-4 rounded-full font-bold text-sm md:text-base">
              Explore Trips
            </Link>
            <Link href="/plan" className="btn-ghost px-8 py-4 rounded-full font-bold text-sm md:text-base backdrop-blur-sm">
              Plan My Custom Trip
            </Link>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <AnimatedStats trips={settings.stat_trips} countries={settings.stat_countries} trekkers={settings.stat_trekkers} trails={settings.stat_trails} />

      {/* ─── FEATURED ADVENTURES ─── */}
      {featuredTrips.length > 0 && (
        <section className="py-20 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHeader eyebrow="Handpicked For You" title="FEATURED ADVENTURES" href="/trips" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredTrips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── UPCOMING TREKRIDERZ TRIPS ─── */}
      {upcomingTrips.length > 0 && (
        <section className="py-16 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHeader eyebrow="Don't Miss Out" title="UPCOMING TRIPS" href="/trips" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingTrips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── FEATURED GUIDES ─── */}
      {guides.length > 0 && (
        <section className="py-16 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHeader eyebrow="Meet Your Trek Leaders" title="FEATURED GUIDES" href="/guides" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {guides.map((g) => <GuideCard key={g.id} guide={g} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── FEATURED HOMESTAYS ─── */}
      {homestays.length > 0 && (
        <section className="py-16 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHeader eyebrow="Stay Local" title="FEATURED HOMESTAYS" href="/homestays" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {homestays.map((h) => <HomestayCard key={h.id} property={h} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── DESTINATIONS STRIP ─── */}
      <section className="py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">Where We Go</p>
          <h2 className="font-display text-4xl md:text-6xl text-white mb-10">POPULAR DESTINATIONS</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {DESTINATIONS.map((d) => (
              <Link key={d.country} href={`/trips?destination=${d.country}`} className="glass-card rounded-2xl p-5 text-center hover:border-accent/30 hover:-translate-y-1 transition-all duration-200 group">
                <div className="text-4xl mb-3">{d.emoji}</div>
                <div className="font-bold text-white text-sm group-hover:text-accent transition-colors">{d.label}</div>
                <div className="text-white/40 text-xs mt-1">{d.desc}</div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/destinations" className="text-accent text-sm hover:underline">Explore all destination guides →</Link>
          </div>
        </div>
      </section>

      {/* ─── TRAVEL STORIES ─── */}
      {stories.length > 0 && (
        <section className="py-16 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHeader eyebrow="From the Trail" title="TRAVEL STORIES" href="/stories" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stories.map((s) => <StoryCard key={s.id} story={s} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── COMMUNITY HIGHLIGHTS / REELS ─── */}
      {reels.length > 0 && (
        <section className="py-16 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHeader eyebrow="Community Highlights" title="TOP REELS" href="/community" hrefLabel="Visit Community →" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {reels.map((r) => <ReelCard key={r.id} reel={r} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── TESTIMONIALS ─── */}
      {stories.length > 0 && (
        <section className="py-16 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold text-center">In Their Words</p>
            <h2 className="font-display text-4xl md:text-6xl text-white mb-10 text-center">TRAVELER VOICES</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stories.slice(0, 3).map((s) => (
                <Link key={s.id} href={`/stories/${s.slug}`} className="glass-card rounded-2xl p-6 block hover:border-accent/20 transition-colors">
                  <p className="text-accent text-2xl mb-3">"</p>
                  <p className="text-white/70 text-sm leading-relaxed line-clamp-4 mb-4">{s.body?.slice(0, 180) || s.title}</p>
                  <p className="text-white/40 text-xs">— {s.destination || "TrekRiderz Traveler"}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── PARTNERS ─── */}
      <section className="py-14 px-5 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Trusted Associations</p>
          <div className="glass-card rounded-2xl p-8 opacity-60">
            <p className="text-white/40 text-sm">Partner & association logos coming soon.</p>
          </div>
        </div>
      </section>

      {/* ─── YOUTUBE SHORTS ─── */}
      <section className="py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <SectionHeader eyebrow="Trail Reels" title="WATCH THE ADVENTURE" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {videos.map((v: { id: string; title: string; embedUrl?: string; embed_url?: string; youtube_url?: string }) => {
              const isShort = /youtube\.com\/shorts\//.test(v.youtube_url || "");
              const idMatch = (v.youtube_url || v.embedUrl || v.embed_url || "").match(/(?:shorts\/|embed\/|v=)([a-zA-Z0-9_-]{11})/);
              const videoId = idMatch?.[1];
              return (
                <div key={v.id} className="glass-card rounded-2xl overflow-hidden">
                  <div className="relative aspect-[9/16]">
                    {isShort && videoId ? (
                      <a href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 w-full h-full block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl">▶</span>
                        </span>
                      </a>
                    ) : (
                      <iframe src={v.embedUrl || v.embed_url} title={v.title} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-white/70 text-xs font-medium line-clamp-1">{v.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <a href={settings.youtube_url} target="_blank" rel="noopener noreferrer" className="btn-accent px-8 py-3 rounded-full font-bold inline-block">
              Follow on YouTube →
            </a>
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER ─── */}
      <Newsletter />

      {/* ─── CUSTOM TRIP PLANNER TEASER ─── */}
      <CTASection
        eyebrow="Built For You"
        title="CUSTOM TRIP PLANNER"
        description="Tell us your budget, fitness level, and dream destination — we'll match you with the perfect trip or build one from scratch. Our team will WhatsApp you within 24 hours."
        primaryLabel="Plan My Custom Trip →"
        primaryHref="/plan"
        secondaryLabel="💬 WhatsApp Us"
        secondaryHref={`https://wa.me/${waNumber}?text=Hi%2C%20I%27d%20like%20to%20plan%20a%20custom%20trip!`}
      />
    </>
  );
}
