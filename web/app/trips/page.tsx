import { createClient } from "@supabase/supabase-js";
import { Suspense } from "react";
import { Trip } from "@/components/TripCard";
import TripsFilterClient from "@/components/TripsFilterClient";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata = buildMetadata({
  title: "Treks & Tours",
  description: "Browse all trekking and tour packages — Western Ghats, Himalayan treks, bike rides, weekend getaways, and spiritual trails across India.",
  path: "/trips",
});

async function getTrips(): Promise<Trip[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("trips")
    .select("id,title,trip_type,destination,start_date,end_date,price_usd,difficulty,is_featured,cover_photo_url")
    .eq("is_public", true)
    .not("status", "eq", "cancelled")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as Trip[]) || [];
}

export default async function TripsPage() {
  const trips = await getTrips();

  return (
    <>
      {/* Hero */}
      <div className="pt-32 pb-12 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">
          All Adventures
        </p>
        <h1 className="font-display text-5xl md:text-7xl text-white mb-4">
          TREKS &amp; TOURS
        </h1>
        <p className="text-white/55 text-base md:text-lg max-w-xl mx-auto">
          From Western Ghats day hikes to multi-day expeditions, bike rides,
          and spiritual trails — find your perfect adventure.
        </p>
      </div>

      <div className="px-5 md:px-8 max-w-7xl mx-auto">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Trips", path: "/trips" }]} />
      </div>

      {/* Filters + Grid — Suspense required for useSearchParams in TripsFilterClient */}
      <div className="px-5 md:px-8 pb-24 max-w-7xl mx-auto">
        <Suspense fallback={<div className="text-white/40 text-sm py-8 text-center">Loading trips...</div>}>
          <TripsFilterClient trips={trips} />
        </Suspense>
      </div>
    </>
  );
}
