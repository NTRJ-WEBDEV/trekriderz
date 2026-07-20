import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import Gallery from "@/components/Gallery";
import DestinationCard, { DestinationCardData } from "@/components/DestinationCard";
import TripCard, { Trip } from "@/components/TripCard";
import GuideCard, { GuideCardData } from "@/components/GuideCard";
import HomestayCard, { HomestayCardData } from "@/components/HomestayCard";
import StoryCard, { StoryCardData } from "@/components/StoryCard";
import JsonLd from "@/components/JsonLd";
import { buildMetadata, placeSchema } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 60;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function getPlace(slug: string) {
  const { data } = await db().from("places_guide").select("*").eq("slug", slug).eq("status", "approved").single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) return buildMetadata({ title: "Destination Not Found", description: "This destination is not available.", path: `/destinations/${slug}` });
  return buildMetadata({
    title: place.name,
    description: place.description?.slice(0, 155) || `${place.name} — trek guide, best time to visit, and everything you need to know.`,
    path: `/destinations/${slug}`,
    image: place.cover_image_url || undefined,
  });
}

export default async function DestinationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) notFound();

  const [nearby, guides, homestays, trips, stories] = await Promise.all([
    db().from("places_guide").select("id, name, slug, state, region, cover_image_url, difficulty, altitude_m").eq("status", "approved").neq("id", place.id).eq("state", place.state).limit(4),
    db().from("guides").select("id, full_name, name, profile_photo_url, photo_url, location, rating, total_reviews, is_premium").eq("status", "approved").ilike("location", `%${place.name}%`).limit(3),
    db().from("properties").select("id, name, city, state, property_type, cover_photo_url").eq("status", "approved").ilike("city", `%${place.name}%`).limit(3),
    db().from("trips").select("id,title,trip_type,destination,start_date,end_date,price_usd,difficulty,is_featured,cover_photo_url").eq("is_public", true).ilike("destination", `%${place.name}%`).limit(3),
    db().from("stories").select("id, title, slug, destination, cover_image_url, body, created_at").eq("status", "approved").ilike("destination", `%${place.name}%`).limit(3),
  ]);

  const tags: string[] = place.tags || [];

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 pt-28 pb-20">
      <JsonLd data={placeSchema(place)} />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Destinations", path: "/destinations" }, { name: place.name, path: `/destinations/${place.slug}` }]} />

      <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden mb-8 img-placeholder">
        {place.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.cover_image_url} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="text-5xl opacity-30">🏔️</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 md:p-10">
          <p className="text-accent text-xs uppercase tracking-widest font-semibold mb-1">{[place.region, place.state].filter(Boolean).join(", ")}</p>
          <h1 className="font-display text-4xl md:text-7xl text-white">{place.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {place.description && (
            <div className="glass-card rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl text-white mb-3">OVERVIEW</h2>
              <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{place.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {place.best_season && <FactCard label="Best Time" value={place.best_season} />}
            {place.difficulty && <FactCard label="Difficulty" value={place.difficulty} />}
            {place.altitude_m && <FactCard label="Altitude" value={`${place.altitude_m.toLocaleString()}m`} />}
            {place.state && <FactCard label="State" value={place.state} />}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((t: string) => <span key={t} className="text-xs px-3 py-1 rounded-full glass text-white/60">✦ {t}</span>)}
            </div>
          )}

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-display text-2xl text-white mb-4">GALLERY</h3>
            <Gallery images={place.cover_image_url ? [place.cover_image_url] : []} emptyLabel="Photos coming soon" />
          </div>

          {trips.data && trips.data.length > 0 && (
            <Section title={`TRIPS TO ${place.name.toUpperCase()}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {(trips.data as Trip[]).map((t) => <TripCard key={t.id} trip={t} />)}
              </div>
            </Section>
          )}

          {guides.data && guides.data.length > 0 && (
            <Section title="LOCAL GUIDES">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {(guides.data as GuideCardData[]).map((g) => <GuideCard key={g.id} guide={g} />)}
              </div>
            </Section>
          )}

          {homestays.data && homestays.data.length > 0 && (
            <Section title="HOMESTAYS NEARBY">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {(homestays.data as HomestayCardData[]).map((h) => <HomestayCard key={h.id} property={h} />)}
              </div>
            </Section>
          )}

          {stories.data && stories.data.length > 0 && (
            <Section title="TRAVEL STORIES">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {(stories.data as StoryCardData[]).map((s) => <StoryCard key={s.id} story={s} />)}
              </div>
            </Section>
          )}

          {nearby.data && nearby.data.length > 0 && (
            <Section title="NEARBY DESTINATIONS">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {(nearby.data as DestinationCardData[]).map((p) => <DestinationCard key={p.id} place={p} />)}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <div className="glass-card rounded-2xl p-6 sticky top-24 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Plan your trip</p>
            <a href="/plan" className="btn-accent w-full py-3 rounded-full font-bold text-sm block mb-3">Plan a Custom Trip →</a>
            <a href="/trips" className="btn-ghost w-full py-3 rounded-full font-bold text-sm block">Browse All Trips</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-4 text-center">
      <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white font-bold text-sm capitalize">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}
