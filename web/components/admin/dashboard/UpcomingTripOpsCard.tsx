import Link from "next/link";
import { Calendar, Users, Cloud, AlertTriangle } from "lucide-react";
import type { UpcomingExpedition } from "@/lib/services/DashboardService";
import { glassCard, HOVER_LIFT } from "@/lib/adminTheme";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function UpcomingTripOpsCard({ expedition }: { expedition: UpcomingExpedition }) {
  const seatsLeft = (expedition.max_seats || 0) - (expedition.booked_seats || 0);
  return (
    <Link
      href="/admin/expeditions"
      className={`block rounded-2xl p-4 h-full ${HOVER_LIFT}`}
      style={glassCard}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-white font-semibold text-sm truncate pr-2">{expedition.title}</div>
        <span className="flex items-center gap-1 text-[11px] text-white/40 shrink-0">
          <Calendar size={12} />{fmtDate(expedition.start_date)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-white/50 mb-2">
        <span>{expedition.guide_name || "No guide"}</span>
        <span className="flex items-center gap-1" style={{ color: seatsLeft <= 0 ? "#EF4444" : undefined }}>
          <Users size={12} />{seatsLeft > 0 ? `${seatsLeft} left` : "Full"}
        </span>
        <span className="flex items-center gap-1 text-white/25" title="Weather not tracked yet">
          <Cloud size={12} />—
        </span>
      </div>
      {expedition.warnings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {expedition.warnings.map((w) => (
            <span
              key={w}
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}
            >
              <AlertTriangle size={10} />{w}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
