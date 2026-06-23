import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import TripCard, { Trip } from "@/components/TripCard";
import TripEnquiryForm from "@/components/TripEnquiryForm";

export const revalidate = 60;

const SAMPLE_TRIPS: Record<string, Trip & {
  inclusions?: string[];
  exclusions?: string[];
  highlights?: string[];
  itinerary?: { day: number; title: string; description: string }[];
  whatsapp_link?: string;
}> = {
  "coorg-coffee-trail": {
    id: "coorg-coffee-trail", name: "Coorg Coffee Trail Trek", type: "trek",
    country: "India", destination: "Coorg, Karnataka", duration_days: 3,
    price_inr: 4999, difficulty: "easy", special_tag: "Popular",
    inclusions: ["Trek guide", "2 nights accommodation", "All meals", "Forest permits", "First aid"],
    exclusions: ["Travel to Coorg", "Personal expenses", "Travel insurance"],
    highlights: ["Coffee estate walk", "Abbé Falls", "Raja's Seat sunset", "Campfire night"],
    itinerary: [
      { day: 1, title: "Arrival & Coffee Estate Walk", description: "Arrive in Coorg, check in, evening walk through aromatic coffee plantations." },
      { day: 2, title: "Forest Trek & Waterfall", description: "Full day trek through Pushpagiri Wildlife Sanctuary, Abbé Falls visit." },
      { day: 3, title: "Raja's Seat Sunrise & Departure", description: "Sunrise at Raja's Seat, local market tour, departure." },
    ],
    whatsapp_link: "https://wa.me/919999999999?text=Hi%2C%20I%27m%20interested%20in%20Coorg%20Coffee%20Trail%20Trek!",
  },
  "nepal-abc": {
    id: "nepal-abc", name: "Nepal Annapurna Base Camp Trek", type: "trek",
    country: "Nepal", destination: "Annapurna, Nepal", duration_days: 12,
    price_inr: 28999, difficulty: "challenging", special_tag: "International",
    inclusions: ["International guide", "Tea house stays", "Breakfast & dinner", "Permits (ACAP + TIMS)", "Airport transfers"],
    exclusions: ["Nepal flights", "Visa fees", "Lunches", "Travel insurance", "Tips"],
    highlights: ["Annapurna Base Camp at 4,130m", "Machhapuchhre Base Camp", "Jhinu hot springs", "Rhododendron forests"],
    itinerary: [
      { day: 1, title: "Arrive Kathmandu", description: "Airport pickup, hotel check-in, trip briefing." },
      { day: 2, title: "Fly to Pokhara", description: "Morning flight, acclimatisation walk." },
      { day: 3, title: "Nayapul to Tikhedhunga", description: "Trek begins. 5–6 hours through local villages." },
    ],
    whatsapp_link: "https://wa.me/919999999999?text=Hi%2C%20interested%20in%20Nepal%20ABC%20Trek!",
  },
};

async function getTrip(id: string) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

async function getRelatedTrips(country: string, excludeId: string): Promise<Trip[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("trips")
      .select("id,name,type,country,destination,duration_days,price_inr,difficulty,special_tag,cover_image")
      .eq("country", country)
      .neq("id", excludeId)
      .limit(3);
    return (data as Trip[]) || [];
  } catch {
    return [];
  }
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "🟢 Easy",
  moderate: "🟡 Moderate",
  challenging: "🔴 Challenging",
  extreme: "⚫ Extreme",
};

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let trip = await getTrip(id);

  // Fall back to sample data for demo slugs
  if (!trip && SAMPLE_TRIPS[id]) trip = SAMPLE_TRIPS[id];
  if (!trip) notFound();

  const related = await getRelatedTrips(trip.country || "India", trip.id);
  const itinerary: { day: number; title: string; description: string }[] = trip.itinerary || [];
  const inclusions: string[] = trip.inclusions || [];
  const exclusions: string[] = trip.exclusions || [];
  const highlights: string[] = trip.highlights || [];
  const whatsapp = trip.whatsapp_link ||
    `https://wa.me/919999999999?text=Hi%2C%20I%27m%20interested%20in%20${encodeURIComponent(trip.name)}`;

  return (
    <>
      {/* Hero */}
      <div className="relative pt-24 pb-16 px-5 md:px-8 min-h-[50vh] flex items-end">
        {trip.cover_image ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${trip.cover_image})` }}
          />
        ) : (
          <div className="absolute inset-0 img-placeholder">
            <div className="flex flex-col items-center gap-2 opacity-30">
              <span className="text-6xl">⛰️</span>
              <span className="text-xs">📸 Trip hero photo</span>
            </div>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "rgba(5,10,5,0.65)" }} />
        <div className="relative z-10 max-w-4xl">
          <Link href="/trips" className="text-accent text-sm hover:underline mb-4 inline-block">
            ← All Trips
          </Link>
          {trip.special_tag && (
            <div className="inline-flex mb-3 ml-4 bg-accent text-dark-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              {trip.special_tag}
            </div>
          )}
          <h1 className="font-display text-4xl md:text-7xl text-white">{trip.name}</h1>
          <p className="text-white/60 text-base mt-2">
            {trip.destination} · {trip.duration_days} days ·{" "}
            {DIFFICULTY_LABEL[trip.difficulty] || trip.difficulty}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* ─── Main content ─── */}
          <div className="lg:col-span-2 space-y-10">
            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="glass-card rounded-2xl p-6 md:p-8">
                <h2 className="font-display text-3xl text-accent mb-5">HIGHLIGHTS</h2>
                <ul className="space-y-2">
                  {highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/75 text-sm">
                      <span className="text-accent mt-0.5">✦</span> {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Itinerary */}
            {itinerary.length > 0 && (
              <div className="glass-card rounded-2xl p-6 md:p-8">
                <h2 className="font-display text-3xl text-white mb-6">ITINERARY</h2>
                <div className="space-y-6">
                  {itinerary.map((day) => (
                    <div key={day.day} className="flex gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <span className="text-accent text-xs font-bold">{day.day}</span>
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm mb-1">{day.title}</p>
                        <p className="text-white/50 text-sm leading-relaxed">{day.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions / Exclusions */}
            {(inclusions.length > 0 || exclusions.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {inclusions.length > 0 && (
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="font-display text-2xl text-accent mb-4">INCLUDED</h3>
                    <ul className="space-y-2">
                      {inclusions.map((item, i) => (
                        <li key={i} className="flex gap-2 text-white/70 text-sm">
                          <span className="text-green-400">✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {exclusions.length > 0 && (
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="font-display text-2xl text-white/60 mb-4">EXCLUDED</h3>
                    <ul className="space-y-2">
                      {exclusions.map((item, i) => (
                        <li key={i} className="flex gap-2 text-white/50 text-sm">
                          <span className="text-red-400/60">✗</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Photo gallery placeholder */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-display text-3xl text-white mb-5">PHOTO GALLERY</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl img-placeholder flex-col gap-1">
                    <span className="text-xl opacity-20">📸</span>
                    <span className="text-[9px]">Drop photo {i + 1} here</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Sidebar ─── */}
          <div className="space-y-5">
            {/* Price card */}
            <div className="glass-card rounded-2xl p-6 sticky top-24">
              <div className="text-center mb-5">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Starting from</p>
                <p className="font-display text-5xl text-accent">
                  ₹{trip.price_inr?.toLocaleString()}
                </p>
                <p className="text-white/40 text-xs mt-1">per person</p>
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Duration</span>
                  <span className="text-white font-medium">{trip.duration_days} days</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Difficulty</span>
                  <span className="text-white font-medium capitalize">{trip.difficulty}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Group Size</span>
                  <span className="text-white font-medium">Max {trip.max_group_size || 15}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Destination</span>
                  <span className="text-white font-medium">{trip.country}</span>
                </div>
              </div>

              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent w-full py-3 rounded-full font-bold text-sm text-center block mb-3"
              >
                💬 Book via WhatsApp
              </a>
              <TripEnquiryForm tripId={trip.id} tripName={trip.name} />
            </div>
          </div>
        </div>

        {/* Related trips */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-4xl text-white mb-6">MORE FROM {(trip.country || "").toUpperCase()}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((t) => (
                <TripCard key={t.id} trip={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
