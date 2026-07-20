import Link from "next/link";

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-green-500/20 text-green-400",
  moderate: "bg-yellow-500/20 text-yellow-400",
  challenging: "bg-orange-500/20 text-orange-400",
  expert: "bg-red-500/20 text-red-400",
};

const TYPE_LABEL: Record<string, string> = {
  trek: "⛰️ Trek",
  bike: "🏍️ Bike Ride",
  temple: "🛕 Spiritual",
  backpacking: "🎒 Backpacking",
  weekend: "🌤️ Weekend",
  car_ride: "🚗 Road Trip",
  spiritual: "🙏 Spiritual",
  wildlife: "🦁 Wildlife",
  photography: "📸 Photography",
};

// Matches the real `trips` table (title/trip_type/destination/price_usd/
// difficulty — the last two via 20260722000001_website_seo_columns.sql).
// Previously assumed name/type/country/price_inr/special_tag/cover_image,
// none of which exist — every query built against that shape silently
// failed and fell back to hardcoded sample data.
export interface Trip {
  id: string;
  title: string;
  trip_type?: string | null;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  price_usd?: number | null;
  difficulty?: string | null;
  is_featured?: boolean;
  cover_photo_url?: string | null;
}

function durationDays(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return days > 0 ? days + 1 : null;
}

export default function TripCard({ trip }: { trip: Trip }) {
  const diffClass = DIFFICULTY_COLOR[trip.difficulty || ""] || "bg-white/10 text-white/50";
  const days = durationDays(trip.start_date, trip.end_date);

  return (
    <Link href={`/trips/${trip.id}`} className="group block">
      <div className="glass-card rounded-2xl overflow-hidden hover:border-accent/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(173,255,47,0.08)]">
        {/* Image */}
        <div className="relative h-52 w-full img-placeholder">
          {trip.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trip.cover_photo_url}
              alt={trip.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 img-placeholder flex-col gap-2">
              <span className="text-3xl opacity-30">⛰️</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
          {trip.is_featured && (
            <div className="absolute top-3 left-3 bg-accent text-dark-900 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              Featured
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-white text-base leading-tight group-hover:text-accent transition-colors line-clamp-2">
              {trip.title}
            </h3>
          </div>
          <p className="text-white/50 text-xs mb-4">
            {trip.destination || "Destination TBA"}{days ? ` · ${days}D` : ""}
          </p>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${diffClass}`}>
              {trip.difficulty ? trip.difficulty : trip.trip_type ? TYPE_LABEL[trip.trip_type] || trip.trip_type : "Adventure"}
            </span>
            {trip.price_usd && (
              <div className="text-right">
                <span className="text-accent font-bold">
                  ${trip.price_usd.toLocaleString()}
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
