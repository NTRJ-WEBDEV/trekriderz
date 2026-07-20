import type { SystemHealth } from "@/lib/services/DashboardService";

function Dot({ ok }: { ok: boolean }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: ok ? "#22C55E" : "#EF4444" }} />;
}

export default function SystemHealthCard({ health }: { health: SystemHealth }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="text-white font-semibold text-sm mb-4">System Health</h3>
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-white/50">Supabase connectivity</span>
          <span className="flex items-center gap-1.5 text-white/70"><Dot ok={health.supabaseOk} />{health.supabaseOk ? "OK" : "Error"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50">Storage</span>
          <span className="flex items-center gap-1.5 text-white/70"><Dot ok={health.storageOk} />{health.storageOk ? "OK" : "Error"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50">Realtime</span>
          <span className="flex items-center gap-1.5 text-white/70"><Dot ok={health.realtimeOk} />{health.realtimeOk ? "OK" : "Error"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50">Deployment</span>
          <span className="text-white/40 text-xs">
            {health.deployment.commit ? `${health.deployment.commit} (${health.deployment.env || "prod"})` : "n/a (local)"}
          </span>
        </div>
      </div>
      {health.envWarnings.length > 0 && (
        <div className="mt-4 pt-4 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {health.envWarnings.map((w) => (
            <div key={w} className="text-xs" style={{ color: "#F59E0B" }}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
