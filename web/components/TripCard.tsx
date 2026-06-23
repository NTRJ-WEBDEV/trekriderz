import Link from "next/link";

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-green-500/20 text-green-400",
  moderate: "bg-yellow-500/20 text-yellow-400",
  challenging: "bg-orange-500/20 text-orange-400",
  extreme: "bg-red-500/20 text-red-400",
};

const COUNTRY_FLAG: Record<string, string> = {
  India: "🇮🇳",
  Nepal: "🇳🇵",
  Bhutan: "🇧🇹",
  Philippines: "🇵🇭",
  Indonesia: "🇮🇩",
  Cambodia: "🇰🇭",
};

export interface Trip {
  id: string;
  name: string;
  type?: string;
  country?: string;
  destination?: string;
  duration_days?: number;
  price_inr?: number;
  difficulty?: string;
  special_tag?: string;
  cover_image?: string;
  status?: string;
}

export default function TripCard({ trip }: { trip: Trip }) {
  const flag = COUNTRY_FLAG[trip.country || "India"] || "🌍";
  const diffClass = DIFFICULTY_COLOR[trip.difficulty || "moderate"] || DIFFICULTY_COLOR.moderate;

  return (
    <Link href={`/trips/${trip.id}`} className="group block">
      <div className="glass-card rounded-2xl overflow-hidden hover:border-accent/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(173,255,47,0.08)]">
        {/* Image */}
        <div className="relative h-52 w-full img-placeholder">
          {trip.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trip.cover_image}
              alt={trip.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 img-placeholder flex-col gap-2">
              <span className="text-3xl opacity-30">⛰️</span>
              <span className="text-[10px]">📸 Drop trip photo here</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
          {trip.special_tag && (
            <div className="absolute top-3 left-3 bg-accent text-dark-900 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              {trip.special_tag}
            </div>
          )}
          <div className="absolute top-3 right-3 text-xl">{flag}</div>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-white text-base leading-tight group-hover:text-accent transition-colors line-clamp-2">
              {trip.name}
            </h3>
          </div>
          <p className="text-white/50 text-xs mb-4">
            {trip.destination} · {trip.duration_days}D
          </p>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${diffClass}`}>
              {trip.difficulty || "moderate"}
            </span>
            {trip.price_inr && (
              <div className="text-right">
                <span className="text-accent font-bold">
                  ₹{trip.price_inr.toLocaleString()}
                </span>
                <span className="text-white/40 text-xs"> /person</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
