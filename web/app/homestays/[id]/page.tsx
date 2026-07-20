import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { BUSINESS_WA } from "@/lib/constants";
import Breadcrumbs from "@/components/Breadcrumbs";
import Gallery from "@/components/Gallery";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 60;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function getProperty(id: string) {
  const { data } = await db().from("properties").select("*").eq("id", id).eq("status", "approved").single();
  return data;
}

async function getNearbyTrips(city: string | null) {
  if (!city) return [];
  const { data } = await db().from("trips").select("id, title, destination").ilike("destination", `%${city}%`).eq("is_public", true).limit(4);
  return data || [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) return buildMetadata({ title: "Homestay Not Found", description: "This homestay is not available.", path: `/homestays/${id}` });
  return buildMetadata({
    title: property.name,
    description: property.description?.slice(0, 155) || `${property.name} — a verified TrekRiderz homestay in ${property.city || "India"}.`,
    path: `/homestays/${id}`,
    image: property.cover_photo_url || undefined,
  });
}

export default async function HomestayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  const nearbyTrips = await getNearbyTrips(property.city);
  const amenities: string[] = Array.isArray(property.amenities) ? property.amenities : [];
  const gallery: string[] = Array.isArray(property.photos) ? property.photos : [];
  const whatsapp = `https://wa.me/${BUSINESS_WA}?text=${encodeURIComponent(`Hi, I'm interested in staying at ${property.name}!`)}`;

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 pt-28 pb-20">
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Homestays", path: "/homestays" }, { name: property.name, path: `/homestays/${property.id}` }]} />

      <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden mb-8 img-placeholder">
        {property.cover_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.cover_photo_url} alt={property.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="text-5xl opacity-30">🏡</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold capitalize">{property.property_type || "Homestay"}</p>
            <h1 className="font-display text-4xl md:text-5xl text-white mb-2">{property.name}</h1>
            <p className="text-white/50 text-sm">📍 {[property.address, property.city, property.state].filter(Boolean).join(", ")}</p>
          </div>

          {property.description && (
            <div className="glass-card rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl text-white mb-3">OVERVIEW</h2>
              <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{property.description}</p>
            </div>
          )}

          {amenities.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-display text-2xl text-white mb-4">AMENITIES</h3>
              <div className="flex flex-wrap gap-2">
                {amenities.map((a, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-full glass text-white/60">✦ {a}</span>)}
              </div>
            </div>
          )}

          {nearbyTrips.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-display text-2xl text-white mb-4">NEARBY TREKS</h3>
              <div className="space-y-3">
                {nearbyTrips.map((t: any) => (
                  <a key={t.id} href={`/trips/${t.id}`} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-white font-medium text-sm">{t.title}</p>
                    <span className="text-accent text-sm">→</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-display text-2xl text-white mb-4">GALLERY</h3>
            <Gallery images={gallery} emptyLabel="Photos coming soon" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass-card rounded-2xl p-6 sticky top-24 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Interested in staying here?</p>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-accent w-full py-3 rounded-full font-bold text-sm block mb-3">
              🏡 Book This Homestay
            </a>
            <p className="text-white/30 text-xs">Bookings are confirmed through the TrekRiderz app.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
