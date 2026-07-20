"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const OPTIONS = [
  { label: "7d", value: "7" },
  { label: "14d", value: "14" },
  { label: "30d", value: "30" },
];

// Controls how far ahead "Upcoming Operations" looks (dashboard KPIs stay
// fixed to "today" — that's the point of that section). Also hosts the
// refresh action, since both are the page's only interactive controls;
// global search and the notifications bell already live in AdminShell's
// persistent header on every admin page, so they aren't duplicated here.
export default function DashboardDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("horizon") || "7";
  const [refreshing, setRefreshing] = useState(false);

  const setHorizon = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("horizon", value);
    router.push(`/admin?${params.toString()}`);
  };

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setHorizon(o.value)}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: current === o.value ? "rgba(249,115,22,0.15)" : "transparent",
              color: current === o.value ? "#F97316" : "rgba(255,255,255,0.5)",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <button
        onClick={refresh}
        disabled={refreshing}
        className="px-3 py-1.5 rounded-xl text-xs font-medium text-white/60 hover:text-white transition-colors"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {refreshing ? "Refreshing…" : "↻ Refresh"}
      </button>
    </div>
  );
}
