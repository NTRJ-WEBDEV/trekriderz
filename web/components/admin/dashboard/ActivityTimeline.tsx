import type { ActivityLogRow } from "@/lib/services/DashboardService";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function actionLabel(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ActivityTimeline({ rows }: { rows: ActivityLogRow[] }) {
  if (rows.length === 0) {
    return <p className="text-white/30 text-sm text-center py-6">No admin actions logged yet.</p>;
  }
  return (
    <div className="space-y-2.5 max-h-96 overflow-y-auto">
      {rows.map((a) => (
        <div key={a.id} className="flex items-start gap-3 text-sm">
          <span
            className="text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full shrink-0 uppercase"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
          >
            {a.source === "web_admin" ? "web" : "mobile"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-white/80 truncate">
              {actionLabel(a.action)}
              <span className="text-white/30"> · {a.actor_role || "unknown"}</span>
            </div>
            {a.reason && <div className="text-white/30 text-xs truncate">"{a.reason}"</div>}
          </div>
          <span className="text-white/25 text-xs shrink-0">{timeAgo(a.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
