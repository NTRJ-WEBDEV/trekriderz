import { BUSINESS_WA } from "@/lib/constants";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import TripCard, { Trip } from "@/components/TripCard";
import TripEnquiryForm from "@/components/TripEnquiryForm";
import Gallery from "@/components/Gallery";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { buildMetadata, tripSchema } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 60;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function getTrip(id: string) {
  const { data } = await db().from("trips").select("*").eq("id", id).eq("is_public", true).single();
  return data;
}

async function getRelatedTrips(destination: string | null, excludeId: string): Promise<Trip[]> {
  if (!destination) return [];
  const { data } = await db()
    .from("trips")
    .select("id,title,trip_type,destination,start_date,end_date,price_usd,difficulty,is_featured,cover_photo_url")
    .ilike("destination", `%${destination.split(",")[0]}%`)
    .eq("is_public", true)
    .neq("id", excludeId)
    .limit(3);
  return (data as Trip[]) || [];
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "🟢 Easy",
  moderate: "🟡 Moderate",
  challenging: "🔴 Challenging",
  expert: "⚫ Expert",
};

function durationDays(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return d > 0 ? d + 1 : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) return buildMetadata({ title: "Trip Not Found", description: "This trip is no longer available.", path: `/trips/${id}` });
  return buildMetadata({
    title: trip.title,
    description: trip.description?.slice(0, 155) || `${trip.title} — ${trip.destination || "an adventure with TrekRiderz"}.`,
    path: `/trips/${id}`,
    image: trip.cover_photo_url || undefined,
    type: "article",
  });
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) notFound();

  const related = await getRelatedTrips(trip.destination, trip.id);
  const itinerary: any[] = Array.isArray(trip.itinerary) ? trip.itinerary : [];
  const inclusions: string[] = trip.inclusions || [];
  const exclusions: string[] = trip.exclusions || [];
  const highlights: string[] = trip.highlights || [];
  const packingList: string[] = Array.isArray(trip.packing_list) ? trip.packing_list.map((p: any) => (typeof p === "string" ? p : p.item)).filter(Boolean) : [];
  const safetyChecklist: string[] = Array.isArray(trip.safety_checklist) ? trip.safety_checklist.map((s: any) => (typeof s === "string" ? s : s.item)).filter(Boolean) : [];
  const gallery: string[] = Array.isArray(trip.photos) ? trip.photos : [];
  const days = durationDays(trip.start_date, trip.end_date);
  const whatsapp = `https://wa.me/${BUSINESS_WA}?text=Hi%2C%20I%27m%20interested%20in%20${encodeURIComponent(trip.title)}`;

  return (
    <>
      <JsonLd data={tripSchema(trip)} />

      {/* Hero */}
      <div className="relative pt-24 pb-16 px-5 md:px-8 min-h-[50vh] flex items-end">
        {trip.cover_photo_url ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${trip.cover_photo_url})` }} />
        ) : (
          <div className="absolute inset-0 img-placeholder">
            <div className="flex flex-col items-center gap-2 opacity-30">
              <span className="text-6xl">⛰️</span>
            </div>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "rgba(5,10,5,0.65)" }} />
        <div className="relative z-10 max-w-4xl w-full">
          <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Trips", path: "/trips" }, { name: trip.title, path: `/trips/${trip.id}` }]} />
          {trip.is_featured && (
            <div className="inline-flex mb-3 bg-accent text-dark-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">Featured</div>
          )}
          <h1 className="font-display text-4xl md:text-7xl text-white">{trip.title}</h1>
          <p className="text-white/60 text-base mt-2">
            {trip.destination}{days ? ` · ${days} days` : ""}{trip.difficulty ? ` · ${DIFFICULTY_LABEL[trip.difficulty] || trip.difficulty}` : ""}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">
            {trip.description && (
              <div className="glass-card rounded-2xl p-6 md:p-8">
                <h2 className="font-display text-3xl text-white mb-4">OVERVIEW</h2>
                <p className="text-white/65 text-sm leading-relaxed whitespace-pre-line">{trip.description}</p>
              </div>
            )}

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

            {itinerary.length > 0 && (
              <div className="glass-card rounded-2xl p-6 md:p-8">
                <h2 className="font-display text-3xl text-white mb-6">ITINERARY</h2>
                <div className="space-y-6">
                  {itinerary.map((day: any, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <span className="text-accent text-xs font-bold">{day.day || i + 1}</span>
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm mb-1">{day.title || `Day ${day.day || i + 1}`}</p>
                        <p className="text-white/50 text-sm leading-relaxed">{day.description || day.activities}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(inclusions.length > 0 || exclusions.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {inclusions.length > 0 && (
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="font-display text-2xl text-accent mb-4">INCLUDED</h3>
                    <ul className="space-y-2">
                      {inclusions.map((item, i) => (
                        <li key={i} className="flex gap-2 text-white/70 text-sm"><span className="text-green-400">✓</span> {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {exclusions.length > 0 && (
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="font-display text-2xl text-white/60 mb-4">EXCLUDED</h3>
                    <ul className="space-y-2">
                      {exclusions.map((item, i) => (
                        <li key={i} className="flex gap-2 text-white/50 text-sm"><span className="text-red-400/60">✗</span> {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {(packingList.length > 0 || safetyChecklist.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {packingList.length > 0 && (
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="font-display text-2xl text-white mb-4">PACKING LIST</h3>
                    <ul className="space-y-1.5">
                      {packingList.map((item, i) => <li key={i} className="text-white/60 text-sm">🎒 {item}</li>)}
                    </ul>
                  </div>
                )}
                {safetyChecklist.length > 0 && (
                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="font-display text-2xl text-white mb-4">SAFETY</h3>
                    <ul className="space-y-1.5">
                      {safetyChecklist.map((item, i) => <li key={i} className="text-white/60 text-sm">🛡️ {item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-display text-3xl text-white mb-5">PHOTO GALLERY</h2>
              <Gallery images={gallery} emptyLabel="Trip photos coming soon" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="glass-card rounded-2xl p-6 sticky top-24">
              <div className="text-center mb-5">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Starting from</p>
                <p className="font-display text-5xl text-accent">
                  {trip.price_usd ? `$${trip.price_usd.toLocaleString()}` : "Ask us"}
                </p>
                {trip.price_usd && <p className="text-white/40 text-xs mt-1">per person</p>}
              </div>

              <div className="space-y-3 mb-6 text-sm">
                {days && <div className="flex justify-between text-white/60"><span>Duration</span><span className="text-white font-medium">{days} days</span></div>}
                {trip.difficulty && <div className="flex justify-between text-white/60"><span>Difficulty</span><span className="text-white font-medium capitalize">{trip.difficulty}</span></div>}
                <div className="flex justify-between text-white/60"><span>Group Size</span><span className="text-white font-medium">Max {trip.max_group_size || trip.group_size || 15}</span></div>
                <div className="flex justify-between text-white/60"><span>Destination</span><span className="text-white font-medium text-right">{trip.destination}</span></div>
              </div>

              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-accent w-full py-3 rounded-full font-bold text-sm text-center block mb-3">
                💬 Book via WhatsApp
              </a>
              <TripEnquiryForm tripId={trip.id} tripName={trip.title} />
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-4xl text-white mb-6">MORE NEAR {(trip.destination || "").split(",")[0].toUpperCase()}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((t) => <TripCard key={t.id} trip={t} />)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
