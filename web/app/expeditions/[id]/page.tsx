import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import BookingButton from "@/components/BookingButton";

export const revalidate = 60;

export default async function ExpeditionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: exp } = await supabase
    .from("guided_expeditions")
    .select(
      `*, guide:guides(id, name, photo_url, is_premium, bio), packages:expedition_packages(*), itinerary:expedition_itinerary_days(*)`
    )
    .eq("id", id)
    .single();

  if (!exp) notFound();

  const itinerary = ((exp.itinerary as any[]) || []).sort(
    (a: any, b: any) => a.day_number - b.day_number
  );

  return (
    <>
      <div className="relative min-h-[50vh] flex items-end pt-24 pb-10 px-5 md:px-8">
        {exp.cover_photos && exp.cover_photos.length > 0 ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${exp.cover_photos[0]})` }}
          />
        ) : (
          <div className="absolute inset-0 img-placeholder">
            <span className="text-4xl opacity-20">⛰</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "rgba(5,10,5,0.65)" }} />
        <div className="relative z-10 max-w-4xl">
          <Link href="/expeditions" className="text-accent text-sm hover:underline mb-4 inline-block">
            Back to Expeditions
          </Link>
          <h1 className="font-display text-4xl md:text-6xl text-white">{exp.title}</h1>
          <p className="text-white/60 mt-2">
            {exp.destination} · {exp.duration_days} days · {exp.difficulty}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            {exp.description && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-display text-3xl text-white mb-4">ABOUT</h2>
                <p className="text-white/65 leading-relaxed text-sm">{exp.description}</p>
              </div>
            )}
            {itinerary.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-display text-3xl text-white mb-6">ITINERARY</h2>
                <div className="space-y-5">
                  {itinerary.map((day: any) => (
                    <div key={day.id} className="flex gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <span className="text-accent text-xs font-bold">{day.day_number}</span>
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm mb-1">{day.title}</p>
                        <p className="text-white/50 text-sm">{day.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-5">
            {exp.packages && (exp.packages as any[]).length > 0 && (
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <p className="text-white/40 text-xs uppercase tracking-widest">Packages</p>
                {(exp.packages as any[]).map((pkg: any) => (
                  <div key={pkg.id} className="space-y-2 border-b border-white/5 last:border-0 pb-4 last:pb-0">
                    <div className="flex justify-between">
                      <span className="text-white/70 text-sm">{pkg.name || "Standard"}</span>
                      <span className="text-accent font-bold">₹{pkg.price_per_person?.toLocaleString()}</span>
                    </div>
                    <BookingButton
                      expeditionId={exp.id}
                      expeditionTitle={exp.title}
                      packageId={pkg.id}
                      packageName={pkg.name || "Standard"}
                      pricePerPerson={pkg.price_per_person}
                    />
                  </div>
                ))}
              </div>
            )}
            <a
              href="https://wa.me/919999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-white/50 text-sm hover:text-white/80 py-2"
            >
              Questions? Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
