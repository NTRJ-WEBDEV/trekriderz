"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import TripCard, { Trip } from "./TripCard";

const COUNTRIES = ["All", "India", "Nepal", "Bhutan", "Philippines", "Indonesia", "Cambodia"];
const TYPES = ["All", "trek", "tour", "stay", "special"];
const DIFFICULTIES = ["All", "easy", "moderate", "challenging", "extreme"];

export default function TripsFilterClient({ trips }: { trips: Trip[] }) {
  const searchParams = useSearchParams();

  // Read initial values from URL params (set when navigating from Destinations page)
  const [country, setCountry] = useState(() => {
    const c = searchParams.get("country");
    return c && COUNTRIES.includes(c) ? c : "All";
  });
  const [type, setType] = useState(() => {
    const t = searchParams.get("type");
    return t && TYPES.includes(t) ? t : "All";
  });
  const [difficulty, setDifficulty] = useState("All");
  const [search, setSearch] = useState("");

  // Re-sync if the URL params change (e.g. user navigates back from detail)
  useEffect(() => {
    const c = searchParams.get("country");
    if (c && COUNTRIES.includes(c)) setCountry(c);
    const t = searchParams.get("type");
    if (t && TYPES.includes(t)) setType(t);
  }, [searchParams]);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      if (country !== "All" && t.country !== country) return false;
      if (type !== "All" && t.type !== type) return false;
      if (difficulty !== "All" && t.difficulty !== difficulty) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [trips, country, type, difficulty, search]);

  const FilterPill = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
        active
          ? "bg-accent text-dark-900"
          : "glass text-white/60 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Active destination badge */}
      {country !== "All" && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-accent text-sm font-semibold">
            Showing trips in {country}
          </span>
          <button
            onClick={() => setCountry("All")}
            className="text-white/40 text-xs hover:text-white glass px-2.5 py-0.5 rounded-full"
          >
            Clear ✕
          </button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="glass-card rounded-2xl p-5 mb-8 space-y-4">
        <input
          type="text"
          placeholder="Search trips..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input text-sm"
        />
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Country</p>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map((c) => (
              <FilterPill key={c} label={c} active={country === c} onClick={() => setCountry(c)} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <FilterPill key={t} label={t} active={type === t} onClick={() => setType(t)} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Difficulty</p>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <FilterPill key={d} label={d} active={difficulty === d} onClick={() => setDifficulty(d)} />
            ))}
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
          <p className="text-white/50 text-lg font-medium">No trips match your filters</p>
          <p className="text-white/30 text-sm mt-1">Try removing a filter or reach out on WhatsApp</p>
          <a
            href="https://wa.me/919999999999?text=Hi%2C%20I%27m%20looking%20for%20a%20trip!"
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
