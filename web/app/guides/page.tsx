import { createClient } from "@supabase/supabase-js";
import GuideCard, { GuideCardData } from "@/components/GuideCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import CTASection from "@/components/CTASection";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata = buildMetadata({
  title: "Verified Trek Guides",
  description: "Browse verified local guides across India — experienced, rated, and ready to lead your next adventure.",
  path: "/guides",
});

async function getGuides(): Promise<GuideCardData[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("guides")
    .select("id, full_name, name, profile_photo_url, photo_url, location, rating, total_reviews, is_premium, specialization")
    .eq("status", "approved")
    .order("is_premium", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false });
  return (data as GuideCardData[]) || [];
}

export default async function GuidesPage() {
  const guides = await getGuides();

  return (
    <>
      <div className="pt-32 pb-12 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">Local Experts</p>
        <h1 className="font-display text-5xl md:text-7xl text-white mb-4">GUIDES</h1>
        <p className="text-white/55 text-base md:text-lg max-w-xl mx-auto">
          Verified, rated, and locally rooted — every TrekRiderz guide is vetted before they lead a group.
        </p>
      </div>

      <div className="px-5 md:px-8 max-w-7xl mx-auto">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }]} />
      </div>

      <div className="px-5 md:px-8 pb-16 max-w-7xl mx-auto">
        {guides.length === 0 ? (
          <div className="glass-card rounded-2xl py-20 text-center">
            <p className="text-4xl mb-4">🧭</p>
            <p className="text-white/50 text-lg font-medium">No verified guides yet</p>
            <p className="text-white/30 text-sm mt-1">Check back soon — new guides are onboarding regularly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((g) => <GuideCard key={g.id} guide={g} />)}
          </div>
        )}
      </div>

      <CTASection
        eyebrow="Join TrekRiderz"
        title="ARE YOU A GUIDE?"
        description="List your treks, reach thousands of travelers, and manage bookings through the TrekRiderz app."
        primaryLabel="Download App to Register"
        primaryHref="https://play.google.com/store"
      />
    </>
  );
}
