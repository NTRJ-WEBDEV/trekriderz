import Link from "next/link";
import type { InboxCard, Urgency } from "@/lib/services/DashboardService";

const URGENCY_COLOR: Record<Urgency, string> = {
  high: "#EF4444",
  medium: "#F97316",
  low: "#9CA3AF",
};

export default function AttentionCard({ card }: { card: InboxCard }) {
  const color = card.count > 0 ? URGENCY_COLOR[card.urgency] : "#9CA3AF";
  return (
    <Link
      href={card.href}
      className="block rounded-2xl p-4 h-full transition-colors hover:opacity-90"
      style={{
        background: card.count > 0 && card.urgency !== "low" ? `${color}14` : "rgba(255,255,255,0.03)",
        border: `1px solid ${card.count > 0 && card.urgency !== "low" ? `${color}40` : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-white/40 text-xs uppercase tracking-wide">{card.label}</span>
        {card.urgency === "high" && card.count > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${color}25`, color }}>
            URGENT
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: card.count > 0 ? color : "#fff" }}>{card.count}</div>
      <p className="text-white/30 text-xs leading-snug">{card.description}</p>
    </Link>
  );
}
