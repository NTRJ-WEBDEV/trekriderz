import { Suspense } from "react";
import SearchResultsClient from "@/components/SearchResultsClient";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Search",
  description: "Search trips, destinations, guides, homestays, rentals, and stories across TrekRiderz.",
  path: "/search",
});

export default function SearchPage() {
  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-32 pb-24">
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Search", path: "/search" }]} />
      <h1 className="font-display text-4xl md:text-6xl text-white mb-8">SEARCH</h1>
      <Suspense fallback={<div className="text-white/40 text-sm py-8 text-center">Loading…</div>}>
        <SearchResultsClient />
      </Suspense>
    </div>
  );
}
