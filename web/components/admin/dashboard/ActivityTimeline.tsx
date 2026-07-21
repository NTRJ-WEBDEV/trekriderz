import {
  UserCheck, CalendarPlus, UserPlus, MapPinPlus, Home, FlagOff, Film, BookOpen, Trophy, Activity,
} from "lucide-react";
import type { ActivityLogRow } from "@/lib/services/DashboardService";
import { ACCENT } from "@/lib/adminTheme";

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

function iconFor(action: string, entityType: string): React.ReactNode {
  if (action.includes("approved") && entityType === "guides") return <UserCheck size={14} />;
  if (entityType === "expeditions" || entityType === "trips") return <CalendarPlus size={14} />;
  if (entityType === "user" || entityType === "users") return <UserPlus size={14} />;
  if (entityType === "homestays" || entityType === "properties") return <Home size={14} />;
  if (entityType === "reports" || action.includes("report")) return <FlagOff size={14} />;
  if (entityType === "posts" && action.includes("reel")) return <Film size={14} />;
  if (entityType === "stories_24h" || entityType === "stories") return <BookOpen size={14} />;
  if (entityType === "reward_candidate" || entityType === "reward_campaign") return <Trophy size={14} />;
  if (entityType === "guides") return <MapPinPlus size={14} />;
  return <Activity size={14} />;
}

export default function ActivityTimeline({ rows }: { rows: ActivityLogRow[] }) {
  if (rows.length === 0) {
    return <p className="text-white/30 text-sm text-center py-6">No admin actions logged yet.</p>;
  }
  return (
    <div className="max-h-96 overflow-y-auto pr-1">
      {rows.map((a, i) => (
        <div key={a.id} className="flex gap-3 relative">
          <div className="flex flex-col items-center">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10"
              style={{ background: "rgba(140,198,63,0.12)", color: ACCENT }}
            >
              {iconFor(a.action, a.entity_type)}
            </span>
            {i < rows.length - 1 && <span className="w-px flex-1 my-0.5" style={{ background: "rgba(255,255,255,0.08)" }} />}
          </div>
          <div className="flex-1 min-w-0 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-white/80 text-sm truncate">
                {actionLabel(a.action)}
                <span className="text-white/30"> · {a.actor_role || "unknown"}</span>
              </div>
              <span className="text-white/25 text-xs shrink-0">{timeAgo(a.created_at)}</span>
            </div>
            {a.reason && <div className="text-white/30 text-xs truncate mt-0.5">"{a.reason}"</div>}
            <span
              className="inline-block text-[9px] mt-1 px-1.5 py-0.5 rounded-full uppercase"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}
            >
              {a.source === "web_admin" ? "web" : "mobile"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
