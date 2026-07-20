export interface RentalCardData {
  id: string;
  make: string | null;
  model: string | null;
  vehicle_type: string;
  price_per_day: number | null;
  location: string | null;
  photos: string[] | null;
  images: string[] | null;
}

export default function RentalCard({ vehicle }: { vehicle: RentalCardData }) {
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type;
  const photo = vehicle.photos?.[0] || vehicle.images?.[0];
  return (
    <div className="glass-card rounded-2xl overflow-hidden hover:border-accent/20 transition-all duration-300 hover:-translate-y-1">
      <div className="relative h-44 w-full img-placeholder">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 img-placeholder flex-col gap-2">
            <span className="text-3xl opacity-30">🚙</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
        <div className="absolute top-3 left-3 glass text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full capitalize">
          {vehicle.vehicle_type}
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-white text-base leading-tight line-clamp-1">{name}</h3>
        <p className="text-white/50 text-xs mt-1 mb-3">{vehicle.location || "Location on request"}</p>
        {vehicle.price_per_day && (
          <p className="text-accent font-bold text-sm">₹{vehicle.price_per_day.toLocaleString("en-IN")} <span className="text-white/40 font-normal text-xs">/day</span></p>
        )}
      </div>
    </div>
  );
}
