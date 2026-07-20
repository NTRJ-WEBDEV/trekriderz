"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SearchBar from "./SearchBar";
import { search, SearchResult } from "@/lib/services/SearchService";

const ENTITY_LABEL: Record<string, string> = {
  trips: "Trip", stories: "Story", vehicles: "Vehicle", places: "Place", pois: "Point of Interest",
  users: "Member", guides: "Guide", homestays: "Homestay", rentals: "Rental", communities: "Community",
  expeditions: "Expedition", posts: "Post",
};

// Reuses web/lib/services/SearchService.ts directly — the same
// config-driven search used by AdminShell's global search bar (Phase 3),
// scoped here to the site's public-facing entities.
export default function SearchResultsClient() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    setLoading(true);
    search(q, ["trips", "stories", "guides", "homestays", "rentals", "places"]).then((r) => {
      setResults(r);
      setLoading(false);
    });
  }, [q]);

  return (
    <div>
      <div className="mb-8"><SearchBar /></div>

      {!q ? (
        <p className="text-white/40 text-sm text-center py-10">Search trips, destinations, guides, homestays, and rentals.</p>
      ) : loading ? (
        <p className="text-white/40 text-sm text-center py-10">Searching…</p>
      ) : results.length === 0 ? (
        <div className="glass-card rounded-2xl py-16 text-center">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-white/50 text-lg font-medium">No results for "{q}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-white/40 text-sm mb-4">{results.length} result{results.length !== 1 ? "s" : ""} for "{q}"</p>
          {results.map((r) => (
            <Link key={`${r.entityType}-${r.id}`} href={detailRoute(r)} className="glass-card rounded-xl p-4 flex items-center justify-between hover:border-accent/20 transition-colors block">
              <div>
                <p className="text-white font-medium text-sm">{r.title}</p>
                {r.subtitle && <p className="text-white/40 text-xs mt-0.5">{r.subtitle}</p>}
              </div>
              <span className="text-[10px] uppercase tracking-widest text-accent shrink-0">{ENTITY_LABEL[r.entityType] || r.entityType}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function detailRoute(r: SearchResult): string {
  switch (r.entityType) {
    case "trips": return `/trips/${r.id}`;
    case "stories": return r.route; // route already points at /stories list; slug not carried by SearchResult
    case "guides": return `/guides/${r.id}`;
    case "homestays": return `/homestays/${r.id}`;
    default: return r.route;
  }
}
