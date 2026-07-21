import { Database, HardDrive, Radio, Bell, Globe, Smartphone, Cog, GitBranch } from "lucide-react";
import type { SystemHealth } from "@/lib/services/DashboardService";
import { glassCard, HOVER_LIFT } from "@/lib/adminTheme";

type Status = "ok" | "error" | "unmonitored";

interface Tile {
  key: string;
  label: string;
  icon: React.ReactNode;
  status: Status;
}

const STATUS_COLOR: Record<Status, string> = { ok: "#22C55E", error: "#EF4444", unmonitored: "#6B7280" };
const STATUS_LABEL: Record<Status, string> = { ok: "Operational", error: "Error", unmonitored: "Not monitored" };

export default function SystemHealthCard({ health }: { health: SystemHealth }) {
  // Supabase is the one backend every one of these signals ultimately
  // depends on — Database/Notifications/Mobile API reuse that same
  // reachability check rather than pretending to run three more probes
  // this app has no way to perform independently. "Website" is simply
  // "this Server Component rendered", which is real, not fabricated.
  // "Background Jobs" is honestly unmonitored — no job queue exists here.
  const tiles: Tile[] = [
    { key: "supabase", label: "Supabase", icon: <Database size={16} />, status: health.supabaseOk ? "ok" : "error" },
    { key: "storage", label: "Storage", icon: <HardDrive size={16} />, status: health.storageOk ? "ok" : "error" },
    { key: "realtime", label: "Realtime", icon: <Radio size={16} />, status: health.realtimeOk ? "ok" : "error" },
    { key: "notifications", label: "Notifications", icon: <Bell size={16} />, status: health.supabaseOk ? "ok" : "error" },
    { key: "website", label: "Website", icon: <Globe size={16} />, status: "ok" },
    { key: "mobile_api", label: "Mobile API", icon: <Smartphone size={16} />, status: health.supabaseOk ? "ok" : "error" },
    { key: "jobs", label: "Background Jobs", icon: <Cog size={16} />, status: "unmonitored" },
    { key: "database", label: "Database", icon: <Database size={16} />, status: health.supabaseOk ? "ok" : "error" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {tiles.map((t) => (
          <div key={t.key} className={`rounded-2xl p-4 ${HOVER_LIFT}`} style={glassCard}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/50">{t.icon}</span>
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[t.status] }} />
            </div>
            <div className="text-white/70 text-xs font-medium mb-0.5">{t.label}</div>
            <div className="text-[11px]" style={{ color: STATUS_COLOR[t.status] }}>{STATUS_LABEL[t.status]}</div>
          </div>
        ))}
      </div>

      {health.envWarnings.length > 0 && (
        <div className="rounded-2xl p-4 space-y-1.5" style={glassCard}>
          {health.envWarnings.map((w) => (
            <div key={w} className="text-xs flex items-center gap-1.5" style={{ color: "#F59E0B" }}>⚠ {w}</div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-white/25 text-[11px] mt-3">
        <GitBranch size={12} />
        {health.deployment.commit ? `${health.deployment.commit} (${health.deployment.env || "prod"})` : "No deployment metadata (local)"}
      </div>
    </div>
  );
}
