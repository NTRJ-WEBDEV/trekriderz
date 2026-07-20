const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  approved: "#22C55E",
  rejected: "#EF4444",
  suspended: "#EF4444",
  published: "#22C55E",
  draft: "#9CA3AF",
  archived: "#6B7280",
  cancelled: "#EF4444",
  ongoing: "#3897F0",
  completed: "#8B5CF6",
  full: "#F59E0B",
  actioned: "#22C55E",
  dismissed: "#6B7280",
};

export default function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "#9CA3AF";
  return (
    <span className="text-[11px] font-bold px-2 py-1 rounded-full capitalize whitespace-nowrap" style={{ background: `${color}1F`, color }}>
      {status}
    </span>
  );
}
