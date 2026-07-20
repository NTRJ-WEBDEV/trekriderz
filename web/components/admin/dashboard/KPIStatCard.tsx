import Link from "next/link";
import type { KPI } from "@/lib/services/DashboardService";

export default function KPIStatCard({ kpi }: { kpi: KPI }) {
  const content = (
    <div className="rounded-2xl p-4 h-full" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-white/40 text-xs uppercase tracking-wide mb-1">{kpi.label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{kpi.value}</span>
        {kpi.delta !== null && (
          <span
            className="text-xs font-semibold"
            style={{ color: kpi.delta > 0 ? "#22C55E" : kpi.delta < 0 ? "#EF4444" : "rgba(255,255,255,0.3)" }}
          >
            {kpi.delta > 0 ? "+" : ""}{kpi.delta} vs yesterday
          </span>
        )}
      </div>
    </div>
  );
  return kpi.href ? <Link href={kpi.href} className="block h-full hover:opacity-90">{content}</Link> : content;
}
