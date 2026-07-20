import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: string;
  accent?: boolean;
  href?: string;
}

export default function StatCard({ label, value, icon, accent, href }: StatCardProps) {
  const content = (
    <div
      className="rounded-2xl p-4 h-full transition-colors"
      style={{
        background: accent ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${accent ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/40 text-xs uppercase tracking-wide">{label}</span>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      <div className="text-2xl font-bold" style={{ color: accent ? "#F97316" : "#fff" }}>{value}</div>
    </div>
  );
  return href ? <Link href={href} className="block h-full hover:opacity-90">{content}</Link> : content;
}
