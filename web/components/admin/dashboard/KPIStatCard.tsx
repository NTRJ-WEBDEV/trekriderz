import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { KPI } from "@/lib/services/DashboardService";
import { glassCard, HOVER_LIFT } from "@/lib/adminTheme";
import CountUp from "./CountUp";
import Sparkline from "./Sparkline";
import PlaceholderStatCard from "./PlaceholderStatCard";

export default function KPIStatCard({ kpi, showSparkline }: { kpi: KPI; showSparkline?: boolean }) {
  if (kpi.tracked === false) return <PlaceholderStatCard label={kpi.label} note="Not tracked — payments are in offline mode" />;

  const content = (
    <div className={`rounded-2xl p-4 h-full ${HOVER_LIFT}`} style={glassCard}>
      <div className="text-white/40 text-xs uppercase tracking-wide mb-1">{kpi.label}</div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-white"><CountUp value={kpi.value} /></span>
        {kpi.delta !== null && (
          <span
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: kpi.delta > 0 ? "#8CC63F" : kpi.delta < 0 ? "#EF4444" : "rgba(255,255,255,0.3)" }}
          >
            {kpi.delta > 0 ? <TrendingUp size={12} /> : kpi.delta < 0 ? <TrendingDown size={12} /> : null}
            {kpi.delta > 0 ? "+" : ""}{kpi.delta}
          </span>
        )}
      </div>
      {showSparkline && <Sparkline positive={(kpi.delta ?? 0) >= 0} />}
    </div>
  );
  return kpi.href ? <Link href={kpi.href} className="block h-full">{content}</Link> : content;
}
