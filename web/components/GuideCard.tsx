import Link from "next/link";

export interface GuideCardData {
  id: string;
  full_name: string | null;
  name: string | null;
  profile_photo_url: string | null;
  photo_url: string | null;
  location: string | null;
  rating: number | null;
  total_reviews: number | null;
  is_premium: boolean;
  specialization?: string | null;
}

export default function GuideCard({ guide }: { guide: GuideCardData }) {
  const name = guide.full_name || guide.name || "Guide";
  const photo = guide.profile_photo_url || guide.photo_url;
  return (
    <Link href={`/guides/${guide.id}`} className="group block">
      <div className="glass-card rounded-2xl overflow-hidden hover:border-accent/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(173,255,47,0.08)]">
        <div className="relative h-52 w-full img-placeholder">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 img-placeholder flex-col gap-2">
              <span className="text-3xl opacity-30">🧭</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
          {guide.is_premium && (
            <div className="absolute top-3 left-3 bg-accent text-dark-900 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              ⭐ Premium
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="font-bold text-white text-base leading-tight group-hover:text-accent transition-colors">{name}</h3>
          <p className="text-white/50 text-xs mt-1 mb-3">{guide.location || guide.specialization || "TrekRiderz Guide"}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">{guide.rating ? `★ ${guide.rating.toFixed(1)}` : "New guide"} {guide.total_reviews ? `(${guide.total_reviews})` : ""}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
