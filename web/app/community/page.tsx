import { createClient } from "@supabase/supabase-js";
import ReelCard, { ReelCardData } from "@/components/ReelCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import CTASection from "@/components/CTASection";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata = buildMetadata({
  title: "The TrekRiderz Community",
  description: "A community of trekkers, riders, and backpackers sharing trails, reels, and adventures — join on the TrekRiderz app.",
  path: "/community",
});

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface PostPreview { id: string; content: string | null; media: string[] | null; created_at: string; authorName?: string | null; }

async function getRecentPosts(): Promise<PostPreview[]> {
  const { data } = await db()
    .from("posts")
    .select("id, content, media, created_at, users(full_name)")
    .is("post_type", null)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(6);
  return ((data as any[]) || []).map((p) => ({ ...p, authorName: p.users?.full_name }));
}

async function getFeaturedReels(): Promise<ReelCardData[]> {
  const { data } = await db()
    .from("posts")
    .select("id, content, media, likes_count, users(full_name)")
    .eq("post_type", "reel")
    .eq("visibility", "public")
    .order("likes_count", { ascending: false })
    .limit(6);
  return ((data as any[]) || []).map((r) => ({ ...r, authorName: r.users?.full_name }));
}

export default async function CommunityPage() {
  const [posts, reels] = await Promise.all([getRecentPosts(), getFeaturedReels()]);

  return (
    <>
      <div className="pt-32 pb-14 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">Trek. Travel. Connect.</p>
        <h1 className="font-display text-5xl md:text-8xl text-white leading-none mb-4">COMMUNITY</h1>
        <p className="text-white/55 text-base md:text-lg max-w-2xl mx-auto">
          TrekRiderz isn't just trips — it's thousands of trekkers, riders, and backpackers sharing trails, reels,
          and plans in one app. Here's a glimpse; the full experience lives on mobile.
        </p>
      </div>

      <div className="px-5 md:px-8 max-w-7xl mx-auto">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Community", path: "/community" }]} />
      </div>

      {reels.length > 0 && (
        <section className="py-10 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-display text-3xl md:text-5xl text-white mb-8">FEATURED REELS</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {reels.map((r) => <ReelCard key={r.id} reel={r} />)}
            </div>
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="py-10 px-5 md:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-display text-3xl md:text-5xl text-white mb-8">RECENT POSTS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map((p) => (
                <div key={p.id} className="glass-card rounded-2xl overflow-hidden">
                  {p.media?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.media[0]} alt="" className="w-full h-40 object-cover" />
                  )}
                  <div className="p-4">
                    <p className="text-white/70 text-sm line-clamp-3">{p.content}</p>
                    <p className="text-white/30 text-xs mt-2">{p.authorName ? `@${p.authorName}` : "TrekRiderz member"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-10 px-5 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display text-3xl md:text-5xl text-white mb-8">ADVENTURE CHALLENGES</h2>
          <div className="glass-card rounded-2xl p-10 text-center opacity-70">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-white/60">Monthly trekking challenges are coming to the app soon.</p>
          </div>
        </div>
      </section>

      <CTASection
        eyebrow="Join the Movement"
        title="THE REAL COMMUNITY LIVES ON MOBILE"
        description="Feed, Reels, Trip planning, Chat, and thousands of fellow trekkers — download the TrekRiderz app to join in."
        primaryLabel="Download the App"
        primaryHref="https://play.google.com/store"
        secondaryLabel="Browse Trips Instead"
        secondaryHref="/trips"
      />
    </>
  );
}
