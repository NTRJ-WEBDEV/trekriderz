"use client";
import DataTable, { Column } from "@/components/admin/DataTable";
import RewardStatusBadge from "./RewardStatusBadge";
import type { CandidateStatus, RewardCandidate } from "@/lib/services/RewardEngineService";

interface ChampionsLeaderboardProps {
  rows: RewardCandidate[];
  loading?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onStatusChange?: (candidateId: string, status: CandidateStatus) => void;
  onAddNote?: (candidateId: string) => void;
  showActions?: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function ChampionsLeaderboard({
  rows, loading, page, pageSize, total, onPageChange, onStatusChange, onAddNote, showActions,
}: ChampionsLeaderboardProps) {
  const columns: Column<RewardCandidate>[] = [
    { key: "rank", label: "Rank", render: (r) => <span className="text-white/40">#{rows.indexOf(r) + 1}</span> },
    {
      key: "user", label: "User",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
            {r.avatar_url && <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div>
            <div className="text-white font-medium">{r.full_name || "Unnamed"}</div>
            <div className="text-white/30 text-xs">{r.email}</div>
          </div>
        </div>
      ),
    },
    { key: "status", label: "Status", render: (r) => <RewardStatusBadge status={r.status} /> },
    { key: "score", label: "Score", render: (r) => <span className="font-bold text-white">{Math.round(r.activity_score)}</span> },
    { key: "active_days", label: "Active Days", render: (r) => <span className="text-white/60">{r.active_days}</span> },
    { key: "posts", label: "Posts", render: (r) => <span className="text-white/60">{r.posts_count}</span> },
    { key: "reels", label: "Reels", render: (r) => <span className="text-white/60">{r.reels_count}</span> },
    { key: "stories", label: "Stories", render: (r) => <span className="text-white/60">{r.stories_count}</span> },
    { key: "comments", label: "Comments", render: (r) => <span className="text-white/60">{r.comments_count}</span> },
    { key: "last_active", label: "Last Active", render: (r) => <span className="text-white/40 text-xs">{fmtDate(r.last_active)}</span> },
    ...(showActions ? [{
      key: "actions", label: "Actions",
      render: (r: RewardCandidate) => (
        <div className="flex gap-1.5 flex-wrap">
          {r.status !== "shortlisted" && <ActionBtn onClick={() => onStatusChange?.(r.id, "shortlisted")}>Shortlist</ActionBtn>}
          {r.status !== "approved" && <ActionBtn onClick={() => onStatusChange?.(r.id, "approved")}>Approve</ActionBtn>}
          {r.status !== "rewarded" && <ActionBtn onClick={() => onStatusChange?.(r.id, "rewarded")}>Mark Rewarded</ActionBtn>}
          {r.status !== "disqualified" && <ActionBtn danger onClick={() => onStatusChange?.(r.id, "disqualified")}>Disqualify</ActionBtn>}
          <ActionBtn onClick={() => onAddNote?.(r.id)}>Note</ActionBtn>
        </div>
      ),
    } as Column<RewardCandidate>] : []),
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      emptyMessage="No candidates yet — recalculate scores to populate the leaderboard."
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
    />
  );
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
      style={{ background: danger ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)", color: danger ? "#EF4444" : "#fff" }}
    >
      {children}
    </button>
  );
}
