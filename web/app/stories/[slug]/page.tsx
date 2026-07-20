import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import StoryCard, { StoryCardData } from "@/components/StoryCard";
import TripCard, { Trip } from "@/components/TripCard";
import JsonLd from "@/components/JsonLd";
import { buildMetadata, articleSchema } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 60;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function getStory(slug: string) {
  const { data } = await db().from("stories").select("*, author:users(full_name)").eq("slug", slug).eq("status", "approved").single();
  return data;
}

async function getRelatedStories(destination: string | null, excludeId: string): Promise<StoryCardData[]> {
  let query = db().from("stories").select("id, title, slug, destination, cover_image_url, body, created_at").eq("status", "approved").neq("id", excludeId).limit(3);
  if (destination) query = query.ilike("destination", `%${destination.split(",")[0]}%`);
  const { data } = await query;
  return (data as StoryCardData[]) || [];
}

async function getRelatedTrip(destination: string | null): Promise<Trip | null> {
  if (!destination) return null;
  const { data } = await db().from("trips").select("id,title,trip_type,destination,start_date,end_date,price_usd,difficulty,is_featured,cover_photo_url").ilike("destination", `%${destination.split(",")[0]}%`).eq("is_public", true).limit(1).maybeSingle();
  return data as Trip | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return buildMetadata({ title: "Story Not Found", description: "This story is not available.", path: `/stories/${slug}` });
  return buildMetadata({
    title: story.title,
    description: story.body?.slice(0, 155) || `${story.title} — a travel story from TrekRiderz.`,
    path: `/stories/${slug}`,
    image: story.cover_image_url || undefined,
    type: "article",
  });
}

export default async function StoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) notFound();

  const [related, relatedTrip] = await Promise.all([
    getRelatedStories(story.destination, story.id),
    getRelatedTrip(story.destination),
  ]);
  const authorName = (story as any).author?.full_name || "TrekRiderz Traveler";

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 pt-28 pb-20">
      <JsonLd data={articleSchema({ ...story, authorName })} />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Stories", path: "/stories" }, { name: story.title, path: `/stories/${story.slug}` }]} />

      {story.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.cover_image_url} alt={story.title} className="w-full h-64 md:h-96 object-cover rounded-3xl mb-8" />
      )}

      <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">{story.destination || "Travel Story"}</p>
      <h1 className="font-display text-4xl md:text-6xl text-white mb-4">{story.title}</h1>
      <p className="text-white/40 text-sm mb-10">By {authorName} · {new Date(story.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>

      <div className="prose prose-invert max-w-none text-white/70 text-base leading-relaxed whitespace-pre-line mb-16">
        {story.body}
      </div>

      {relatedTrip && (
        <div className="glass-accent rounded-2xl p-6 mb-12 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-accent text-xs uppercase tracking-widest font-semibold mb-1">Inspired?</p>
            <p className="text-white font-medium">Book a trip to {story.destination}</p>
          </div>
          <a href={`/trips/${relatedTrip.id}`} className="btn-accent px-6 py-2.5 rounded-full font-bold text-sm shrink-0">View Trip →</a>
        </div>
      )}

      {related.length > 0 && (
        <div>
          <h2 className="font-display text-3xl text-white mb-6">MORE STORIES</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {related.map((s) => <StoryCard key={s.id} story={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}
