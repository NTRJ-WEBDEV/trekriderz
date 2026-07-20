"use client";

import { BUSINESS_WA } from "@/lib/constants";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import TripCard, { Trip } from "./TripCard";

const TYPES = ["All", "trek", "bike", "weekend", "backpacking", "temple", "spiritual", "wildlife", "photography", "car_ride"];
const DIFFICULTIES = ["All", "easy", "moderate", "challenging", "expert"];

function tripDays(t: Trip): number | null {
  if (!t.start_date || !t.end_date) return null;
  const d = Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000);
  return d > 0 ? d + 1 : null;
}

export default function TripsFilterClient({ trips }: { trips: Trip[] }) {
  const searchParams = useSearchParams();

  const [destination, setDestination] = useState(() => searchParams.get("destination") || "");
  const [type, setType] = useState(() => {
    const t = searchParams.get("type");
    return t && TYPES.includes(t) ? t : "All";
  });
  const [difficulty, setDifficulty] = useState("All");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const d = searchParams.get("destination");
    if (d) setDestination(d);
    const t = searchParams.get("type");
    if (t && TYPES.includes(t)) setType(t);
  }, [searchParams]);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      if (destination && !(t.destination || "").toLowerCase().includes(destination.toLowerCase())) return false;
      if (type !== "All" && t.trip_type !== type) return false;
      if (difficulty !== "All" && t.difficulty !== difficulty) return false;
      if (maxPrice && t.price_usd && t.price_usd > Number(maxPrice)) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [trips, destination, type, difficulty, maxPrice, search]);

  const FilterPill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
        active ? "bg-accent text-dark-900" : "glass text-white/60 hover:text-white"
      }`}
    >
      {label.replace("_", " ")}
    </button>
  );

  return (
    <>
      {destination && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-accent text-sm font-semibold">Showing trips in {destination}</span>
          <button onClick={() => setDestination("")} className="text-white/40 text-xs hover:text-white glass px-2.5 py-0.5 rounded-full">
            Clear ✕
          </button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="glass-card rounded-2xl p-5 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" placeholder="Search trips..." value={search} onChange={(e) => setSearch(e.target.value)} className="form-input text-sm" />
          <input type="text" placeholder="Destination / location..." value={destination} onChange={(e) => setDestination(e.target.value)} className="form-input text-sm" />
          <input type="number" placeholder="Max price (USD)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="form-input text-sm" />
        </div>
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => <FilterPill key={t} label={t} active={type === t} onClick={() => setType(t)} />)}
          </div>
        </div>
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Difficulty</p>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => <FilterPill key={d} label={d} active={difficulty === d} onClick={() => setDifficulty(d)} />)}
          </div>
        </div>
      </div>

      <p className="text-white/40 text-sm mb-6">
        {filtered.length} trip{filtered.length !== 1 ? "s" : ""} found
      </p>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl py-20 text-center">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-white/50 text-lg font-medium">{trips.length === 0 ? "No trips published yet" : "No trips match your filters"}</p>
          <p className="text-white/30 text-sm mt-1">
            {trips.length === 0 ? "Check back soon, or tell us what you're after." : "Try removing a filter or reach out on WhatsApp"}
          </p>
          <a
            href={`https://wa.me/${BUSINESS_WA}?text=Hi%2C%20I%27m%20looking%20for%20a%20trip!`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block btn-accent px-6 py-2.5 rounded-full text-sm font-bold"
          >
            Ask on WhatsApp
          </a>
        </div>
      )}
    </>
  );
}
