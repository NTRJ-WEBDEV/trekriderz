import Link from "next/link";
import type { UpcomingExpedition } from "@/lib/services/DashboardService";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function UpcomingTripOpsCard({ expedition }: { expedition: UpcomingExpedition }) {
  const seatsLeft = (expedition.max_seats || 0) - (expedition.booked_seats || 0);
  return (
    <Link
      href={`/admin/expeditions`}
      className="block rounded-2xl p-4 h-full hover:opacity-90"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-white font-medium text-sm truncate pr-2">{expedition.title}</div>
        <span className="text-[11px] text-white/30 shrink-0">{fmtDate(expedition.start_date)}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-white/50 mb-2">
        <span>{expedition.guide_name || "No guide"}</span>
        <span>·</span>
        <span style={{ color: seatsLeft <= 0 ? "#EF4444" : undefined }}>{seatsLeft > 0 ? `${seatsLeft} seats left` : "Full"}</span>
      </div>
      {expedition.warnings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {expedition.warnings.map((w) => (
            <span key={w} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>
              {w}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
