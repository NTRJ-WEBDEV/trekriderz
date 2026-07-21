import Link from "next/link";
import {
  Siren, Compass, Home, Car, Flag, Mail, CreditCard, Ban, ImageOff, ArrowRight,
} from "lucide-react";
import type { InboxCard } from "@/lib/services/DashboardService";
import { URGENCY_COLORS, HOVER_LIFT } from "@/lib/adminTheme";

const ICONS: Record<string, React.ReactNode> = {
  sos: <Siren size={18} />,
  guides: <Compass size={18} />,
  homestays: <Home size={18} />,
  rentals: <Car size={18} />,
  reports: <Flag size={18} />,
  enquiries: <Mail size={18} />,
  bookings: <CreditCard size={18} />,
  communities: <Ban size={18} />,
  missing_info: <ImageOff size={18} />,
  expeditions: <Compass size={18} />,
};

export default function AttentionCard({ card }: { card: InboxCard }) {
  const color = card.count > 0 ? URGENCY_COLORS[card.urgency] : "#6B7280";
  const emphasized = card.count > 0 && card.urgency !== "low";

  return (
    <Link
      href={card.href}
      className={`group block rounded-2xl p-5 h-full ${HOVER_LIFT}`}
      style={{
        background: emphasized ? `${color}12` : "rgba(255,255,255,0.03)",
        border: `1px solid ${emphasized ? `${color}45` : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}1F`, color }}>
          {ICONS[card.key] ?? <Flag size={18} />}
        </span>
        {card.urgency === "high" && card.count > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${color}25`, color }}>
            URGENT
          </span>
        )}
      </div>
      <div className="text-3xl font-bold mb-1" style={{ color: card.count > 0 ? color : "#fff" }}>{card.count}</div>
      <div className="text-white/70 text-sm font-medium mb-1">{card.label}</div>
      <p className="text-white/30 text-xs leading-snug mb-3">{card.description}</p>
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
        Go <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
