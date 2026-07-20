"use client";
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin panel error:", error);
  }, [error]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <h2 className="text-white text-lg font-semibold mb-2">Something went wrong loading this page.</h2>
        <p className="text-white/40 text-sm mb-6">{error.message || "An unexpected error occurred."}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
