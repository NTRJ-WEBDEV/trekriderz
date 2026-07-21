import { glassCard, HOVER_LIFT } from "@/lib/adminTheme";

// For metrics the current schema/analytics stack doesn't capture yet
// (website visitors, retention, trending, weather, DB version/backup...).
// Rendered honestly as "not tracked" rather than showing a fabricated
// number — visually complete so the section reads finished, not broken.
export default function PlaceholderStatCard({ label, note = "Not tracked yet" }: { label: string; note?: string }) {
  return (
    <div className={`rounded-2xl p-4 h-full ${HOVER_LIFT}`} style={glassCard}>
      <div className="text-white/40 text-xs uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-white/15 mb-1">—</div>
      <div className="text-white/20 text-[11px]">{note}</div>
    </div>
  );
}
