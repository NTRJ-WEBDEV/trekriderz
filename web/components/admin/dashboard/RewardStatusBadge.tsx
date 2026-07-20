import type { CandidateStatus } from "@/lib/services/RewardEngineService";

const STATUS_COLORS: Record<CandidateStatus, string> = {
  eligible: "#9CA3AF",
  shortlisted: "#F59E0B",
  approved: "#3897F0",
  rewarded: "#22C55E",
  disqualified: "#EF4444",
};

export default function RewardStatusBadge({ status }: { status: CandidateStatus }) {
  const color = STATUS_COLORS[status] || "#9CA3AF";
  return (
    <span className="text-[11px] font-bold px-2 py-1 rounded-full capitalize whitespace-nowrap" style={{ background: `${color}1F`, color }}>
      {status}
    </span>
  );
}
