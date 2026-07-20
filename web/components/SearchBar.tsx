"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar({ placeholder = "Search treks, destinations, guides…" }: { placeholder?: string }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Search TrekRiderz"
        className="form-input text-sm pr-24 py-4 rounded-full"
      />
      <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 btn-accent px-5 rounded-full text-xs font-bold">
        Search
      </button>
    </form>
  );
}
