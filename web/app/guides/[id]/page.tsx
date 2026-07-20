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

async function getGuide(id: string) {
  const { data } = await db().from("guides").select("*").eq("id", id).eq("status", "approved").single();
  return data;
}

async function getGuideExpeditions(guideId: string) {
  const { data } = await db().from("guided_expeditions").select("id, title, destination, start_date, cover_photos").eq("guide_id", guideId).eq("status", "published").limit(6);
  return data || [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const guide = await getGuide(id);
  const name = guide?.full_name || guide?.name || "Guide";
  if (!guide) return buildMetadata({ title: "Guide Not Found", description: "This guide profile is not available.", path: `/guides/${id}` });
  return buildMetadata({
    title: `${name} — Trek Guide`,
    description: guide.about || guide.bio || `${name}, a verified TrekRiderz guide${guide.location ? ` based in ${guide.location}` : ""}.`,
    path: `/guides/${id}`,
    image: guide.profile_photo_url || guide.photo_url || undefined,
  });
}

export default async function GuideProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guide = await getGuide(id);
  if (!guide) notFound();

  const expeditions = await getGuideExpeditions(guide.id);
  const name = guide.full_name || guide.name || "Guide";
  const photo = guide.profile_photo_url || guide.photo_url;
  const gallery: string[] = Array.isArray(guide.photos) ? guide.photos : [];
  const languages: string[] = guide.languages || [];
  const certificates: any[] = guide.certificates || guide.certifications || [];
  const locations: string[] = guide.locations || (guide.location ? [guide.location] : []);
  const whatsapp = `https://wa.me/${BUSINESS_WA}?text=${encodeURIComponent(`Hi, I'd like to book ${name} as my trek guide!`)}`;

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 pt-28 pb-20">
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name, path: `/guides/${guide.id}` }]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row gap-6">
            <div className="w-28 h-28 rounded-2xl overflow-hidden img-placeholder shrink-0">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl opacity-30">🧭</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-display text-3xl md:text-4xl text-white">{name}</h1>
                {guide.is_premium && <span className="bg-accent text-dark-900 text-[10px] font-bold uppercase px-2 py-1 rounded-full">⭐ Premium</span>}
              </div>
              <p className="text-white/50 text-sm mb-2">{locations.join(", ") || "Location on request"}</p>
              <p className="text-white/60 text-sm">
                {guide.rating ? `★ ${guide.rating.toFixed(1)} rating` : "New guide"} {guide.total_reviews ? `· ${guide.total_reviews} reviews` : ""} {guide.experience_years ? `· ${guide.experience_years}+ years experience` : ""}
              </p>
            </div>
          </div>

          {(guide.about || guide.bio) && (
            <div className="glass-card rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl text-white mb-3">ABOUT</h2>
              <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{guide.about || guide.bio}</p>
            </div>
          )}

          {languages.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-display text-xl text-white mb-3">LANGUAGES</h3>
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => <span key={l} className="text-xs px-3 py-1 rounded-full glass text-white/60">{l}</span>)}
              </div>
            </div>
          )}

          {certificates.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-display text-xl text-white mb-3">CERTIFICATIONS</h3>
              <ul className="space-y-1.5">
                {certificates.map((c: any, i: number) => <li key={i} className="text-white/60 text-sm">🎓 {typeof c === "string" ? c : c.name}</li>)}
              </ul>
            </div>
          )}

          {expeditions.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-display text-2xl text-white mb-4">EXPEDITIONS BY {name.split(" ")[0].toUpperCase()}</h3>
              <div className="space-y-3">
                {expeditions.map((e: any) => (
                  <a key={e.id} href={`/expeditions/${e.id}`} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <p className="text-white font-medium text-sm">{e.title}</p>
                      <p className="text-white/40 text-xs">{e.destination}</p>
                    </div>
                    <span className="text-accent text-sm">→</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-display text-2xl text-white mb-3">REVIEWS</h3>
            <p className="text-white/40 text-sm">Guide reviews are coming soon — check the TrekRiderz app for the latest traveler feedback.</p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-display text-2xl text-white mb-4">GALLERY</h3>
            <Gallery images={gallery} emptyLabel="Photos coming soon" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass-card rounded-2xl p-6 sticky top-24 text-center">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Ready to trek together?</p>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-accent w-full py-3 rounded-full font-bold text-sm block mb-3">
              💬 Contact Guide
            </a>
            <p className="text-white/30 text-xs">Bookings are confirmed through the TrekRiderz app.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
