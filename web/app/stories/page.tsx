import { createClient } from "@supabase/supabase-js";
import StoryCard, { StoryCardData } from "@/components/StoryCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata = buildMetadata({
  title: "Travel Stories",
  description: "Real trip stories from the TrekRiderz community — trail notes, bike trips, and adventures across India and beyond.",
  path: "/stories",
});

async function getStories(): Promise<StoryCardData[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("stories")
    .select("id, title, slug, destination, cover_image_url, body, created_at, is_featured, author:users(full_name)")
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });
  return ((data as any[]) || []).map((s) => ({ ...s, authorName: s.author?.full_name }));
}

export default async function StoriesPage() {
  const stories = await getStories();

  return (
    <>
      <div className="pt-32 pb-12 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">From the Trail</p>
        <h1 className="font-display text-5xl md:text-7xl text-white mb-4">TRAVEL STORIES</h1>
        <p className="text-white/55 text-base md:text-lg max-w-xl mx-auto">
          Real adventures, written by the people who lived them.
        </p>
      </div>

      <div className="px-5 md:px-8 max-w-7xl mx-auto">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Stories", path: "/stories" }]} />
      </div>

      <div className="px-5 md:px-8 pb-24 max-w-7xl mx-auto">
        {stories.length === 0 ? (
          <div className="glass-card rounded-2xl py-20 text-center">
            <p className="text-4xl mb-4">📖</p>
            <p className="text-white/50 text-lg font-medium">No stories published yet</p>
            <p className="text-white/30 text-sm mt-1">Check back soon for trail notes from the community.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((s) => <StoryCard key={s.id} story={s} />)}
          </div>
        )}
      </div>
    </>
  );
}
