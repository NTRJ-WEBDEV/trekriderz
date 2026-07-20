import Link from "next/link";

export interface DestinationCardData {
  id: string;
  name: string;
  slug: string;
  state: string | null;
  region: string | null;
  cover_image_url: string | null;
  difficulty: string | null;
  altitude_m: number | null;
}

export default function DestinationCard({ place }: { place: DestinationCardData }) {
  return (
    <Link href={`/destinations/${place.slug}`} className="group block">
      <div className="glass-card rounded-2xl overflow-hidden hover:border-accent/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(173,255,47,0.08)]">
        <div className="relative h-44 w-full img-placeholder">
          {place.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.cover_image_url} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 img-placeholder flex-col gap-2">
              <span className="text-3xl opacity-30">🏔️</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
          {place.altitude_m && (
            <div className="absolute top-3 right-3 glass text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              {place.altitude_m.toLocaleString()}m
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="font-bold text-white text-base leading-tight group-hover:text-accent transition-colors">{place.name}</h3>
          <p className="text-white/50 text-xs mt-1 capitalize">{[place.region, place.state].filter(Boolean).join(", ")} {place.difficulty && `· ${place.difficulty}`}</p>
        </div>
      </div>
    </Link>
  );
}
