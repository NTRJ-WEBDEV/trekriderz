import Link from "next/link";

export interface HomestayCardData {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  property_type: string | null;
  cover_photo_url: string | null;
}

export default function HomestayCard({ property }: { property: HomestayCardData }) {
  return (
    <Link href={`/homestays/${property.id}`} className="group block">
      <div className="glass-card rounded-2xl overflow-hidden hover:border-accent/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(173,255,47,0.08)]">
        <div className="relative h-52 w-full img-placeholder">
          {property.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={property.cover_photo_url} alt={property.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 img-placeholder flex-col gap-2">
              <span className="text-3xl opacity-30">🏡</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
          {property.property_type && (
            <div className="absolute top-3 left-3 glass text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full capitalize">
              {property.property_type}
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="font-bold text-white text-base leading-tight group-hover:text-accent transition-colors line-clamp-1">{property.name}</h3>
          <p className="text-white/50 text-xs mt-1">{[property.city, property.state].filter(Boolean).join(", ") || "Location on request"}</p>
        </div>
      </div>
    </Link>
  );
}
