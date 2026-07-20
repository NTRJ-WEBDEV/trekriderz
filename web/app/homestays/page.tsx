import { createClient } from "@supabase/supabase-js";
import HomestayCard, { HomestayCardData } from "@/components/HomestayCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import CTASection from "@/components/CTASection";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata = buildMetadata({
  title: "Homestays Near India's Best Treks",
  description: "Discover verified homestays near trekking trails and destinations across India — warm hosts, local food, and trailhead-close stays.",
  path: "/homestays",
});

async function getHomestays(): Promise<HomestayCardData[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("properties")
    .select("id, name, city, state, property_type, cover_photo_url")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  return (data as HomestayCardData[]) || [];
}

export default async function HomestaysPage() {
  const homestays = await getHomestays();

  return (
    <>
      <div className="pt-32 pb-12 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">Stay Local</p>
        <h1 className="font-display text-5xl md:text-7xl text-white mb-4">HOMESTAYS</h1>
        <p className="text-white/55 text-base md:text-lg max-w-xl mx-auto">
          Verified homestays near the trails — warm hosts, home-cooked meals, and a real taste of the destination.
        </p>
      </div>

      <div className="px-5 md:px-8 max-w-7xl mx-auto">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Homestays", path: "/homestays" }]} />
      </div>

      <div className="px-5 md:px-8 pb-16 max-w-7xl mx-auto">
        {homestays.length === 0 ? (
          <div className="glass-card rounded-2xl py-20 text-center">
            <p className="text-4xl mb-4">🏡</p>
            <p className="text-white/50 text-lg font-medium">No homestays listed yet</p>
            <p className="text-white/30 text-sm mt-1">Hosts are onboarding through the TrekRiderz app.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homestays.map((h) => <HomestayCard key={h.id} property={h} />)}
          </div>
        )}
      </div>

      <CTASection
        eyebrow="Host With Us"
        title="OWN A HOMESTAY?"
        description="List your property on TrekRiderz and reach trekkers heading to your area."
        primaryLabel="Download App to Register"
        primaryHref="https://play.google.com/store"
      />
    </>
  );
}
