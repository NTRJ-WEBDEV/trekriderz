import { createClient } from "@supabase/supabase-js";
import { BUSINESS_WA } from "@/lib/constants";
import RentalCard, { RentalCardData } from "@/components/RentalCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata = buildMetadata({
  title: "Trek & Ride Rentals",
  description: "Rent bikes, cars, and adventure vehicles for your next trip — verified owners, transparent daily pricing.",
  path: "/rentals",
});

async function getVehicles(): Promise<RentalCardData[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("rental_vehicles")
    .select("id, make, model, vehicle_type, price_per_day, location, photos, images")
    .eq("status", "approved")
    .eq("is_available", true)
    .order("created_at", { ascending: false });
  return (data as RentalCardData[]) || [];
}

// Only vehicles have a real backing table today — Camping, Photography,
// and Adventure Equipment gear categories don't exist in the schema yet
// (confirmed: no gear/equipment table anywhere), so they render as an
// honest "coming soon" rather than fabricated listings.
const GEAR_CATEGORIES = [
  { label: "Camping Gear", icon: "⛺" },
  { label: "Photography Gear", icon: "📷" },
  { label: "Adventure Equipment", icon: "🧗" },
];

export default async function RentalsPage() {
  const vehicles = await getVehicles();

  return (
    <>
      <div className="pt-32 pb-12 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">Gear Up</p>
        <h1 className="font-display text-5xl md:text-7xl text-white mb-4">RENTALS</h1>
        <p className="text-white/55 text-base md:text-lg max-w-xl mx-auto">
          Bikes and vehicles from verified local owners — book by the day, pick up near the trailhead.
        </p>
      </div>

      <div className="px-5 md:px-8 max-w-7xl mx-auto">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Rentals", path: "/rentals" }]} />
      </div>

      <div className="px-5 md:px-8 pb-10 max-w-7xl mx-auto">
        <h2 className="font-display text-3xl text-white mb-6">VEHICLES</h2>
        {vehicles.length === 0 ? (
          <div className="glass-card rounded-2xl py-16 text-center">
            <p className="text-4xl mb-4">🚙</p>
            <p className="text-white/50 text-lg font-medium">No vehicles listed yet</p>
            <p className="text-white/30 text-sm mt-1">Owners are onboarding through the TrekRiderz app.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((v) => <RentalCard key={v.id} vehicle={v} />)}
          </div>
        )}
      </div>

      <div className="px-5 md:px-8 pb-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {GEAR_CATEGORIES.map((c) => (
            <div key={c.label} className="glass-card rounded-2xl p-6 text-center opacity-60">
              <div className="text-3xl mb-2">{c.icon}</div>
              <p className="text-white font-semibold text-sm">{c.label}</p>
              <p className="text-white/30 text-xs mt-1">Coming soon</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 md:px-8 pb-24 text-center">
        <div className="glass-accent rounded-3xl p-10">
          <h2 className="font-display text-4xl text-white mb-3">HAVE A VEHICLE TO RENT OUT?</h2>
          <p className="text-white/55 text-sm mb-6">List it on TrekRiderz and earn from trekkers passing through your area.</p>
          <a href={`https://wa.me/${BUSINESS_WA}?text=Hi%2C%20I%27d%20like%20to%20list%20a%20rental%20vehicle!`} target="_blank" rel="noopener noreferrer" className="inline-block btn-accent px-8 py-3 rounded-full font-bold">
            💬 Ask Us How
          </a>
        </div>
      </div>
    </>
  );
}
