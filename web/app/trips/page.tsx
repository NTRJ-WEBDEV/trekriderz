import { createClient } from "@supabase/supabase-js";
import { Suspense } from "react";
import { Trip } from "@/components/TripCard";
import TripsFilterClient from "@/components/TripsFilterClient";

export const revalidate = 60;

export const metadata = {
  title: "Treks & Tours | TrekRiderz",
  description:
    "Browse all trekking and tour packages — Western Ghats, Himalayan treks, international tours to Nepal, Bhutan, Philippines, Indonesia and Cambodia.",
};

const SAMPLE_TRIPS: Trip[] = [
  { id: "coorg-coffee-trail", name: "Coorg Coffee Trail Trek", type: "trek", country: "India", destination: "Coorg, Karnataka", duration_days: 3, price_inr: 4999, difficulty: "easy", special_tag: "Popular" },
  { id: "hampi-heritage", name: "Hampi Heritage Walk", type: "tour", country: "India", destination: "Hampi, Karnataka", duration_days: 2, price_inr: 3499, difficulty: "easy" },
  { id: "nepal-abc", name: "Nepal Annapurna Base Camp", type: "trek", country: "Nepal", destination: "Annapurna, Nepal", duration_days: 12, price_inr: 28999, difficulty: "challenging", special_tag: "International" },
  { id: "bhutan-kingdom", name: "Bhutan Kingdom Tour", type: "tour", country: "Bhutan", destination: "Thimphu & Paro, Bhutan", duration_days: 7, price_inr: 45999, difficulty: "easy", special_tag: "International" },
  { id: "philippines-palawan", name: "Philippines Palawan Adventure", type: "tour", country: "Philippines", destination: "Palawan, Philippines", duration_days: 6, price_inr: 39999, difficulty: "moderate", special_tag: "International" },
  { id: "birthday-goa", name: "Birthday Goa Escape", type: "special", country: "India", destination: "North Goa", duration_days: 3, price_inr: 7999, difficulty: "easy", special_tag: "🎉 Birthday" },
  { id: "anniversary-coorg", name: "Anniversary Coorg Retreat", type: "special", country: "India", destination: "Coorg, Karnataka", duration_days: 2, price_inr: 9999, difficulty: "easy", special_tag: "❤️ Anniversary" },
];

export default async function TripsPage() {
  let trips: Trip[] = SAMPLE_TRIPS;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("trips")
      .select("id,name,type,country,destination,duration_days,price_inr,difficulty,special_tag,cover_image,status")
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) trips = data as Trip[];
  } catch {}

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
          From Western Ghats day hikes to 12-day Himalayan expeditions and
          international tours — find your perfect adventure.
        </p>
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
