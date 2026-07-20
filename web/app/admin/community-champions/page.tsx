"use client";
import { useEffect, useState, useCallback } from "react";
import { useAdminPermissions } from "@/lib/adminPermissions";
import ChampionsLeaderboard from "@/components/admin/dashboard/ChampionsLeaderboard";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  fetchCampaigns, fetchCandidates, recalculateScores, setCandidateStatus, addCandidateNote, candidatesToCsv,
  type RewardCampaign, type RewardCandidate, type CandidateStatus,
} from "@/lib/services/RewardEngineService";

const PAGE_SIZE = 20;

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CommunityChampionsPage() {
  const { hasPermission } = useAdminPermissions();
  const [campaigns, setCampaigns] = useState<RewardCampaign[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [rows, setRows] = useState<RewardCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [noteTarget, setNoteTarget] = useState<RewardCandidate | null>(null);
  const [toast, setToast] = useState("");

  const canManage = hasPermission("reward_campaigns.manage");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    fetchCampaigns().then((c) => {
      setCampaigns(c);
      if (c.length > 0) setCampaignId(c[0].id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const { rows, total } = await fetchCandidates(campaignId, { page, pageSize: PAGE_SIZE });
      setRows(rows);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  }, [campaignId, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [campaignId]);

  const handleRecalculate = async () => {
    if (!campaignId) return;
    setRecalculating(true);
    try {
      const count = await recalculateScores(campaignId);
      showToast(`Recalculated scores for ${count} candidate(s).`);
      await load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handleStatusChange = async (candidateId: string, status: CandidateStatus) => {
    try {
      await setCandidateStatus(candidateId, status);
      showToast(`Marked ${status}.`);
      await load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  const handleAddNote = async (note?: string) => {
    if (!noteTarget || note === undefined) return;
    try {
      await addCandidateNote(noteTarget.id, note);
      showToast("Note saved.");
      setNoteTarget(null);
      await load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  const activeCampaign = campaigns.find((c) => c.id === campaignId);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white text-2xl font-bold">Community Champions</h1>
          <p className="text-white/40 text-sm mt-0.5">Reward the most active members of the TrekRiderz community.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={campaignId || ""}
          onChange={(e) => setCampaignId(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (inactive)"}</option>)}
        </select>
        {canManage && (
          <button
            onClick={handleRecalculate}
            disabled={recalculating || !campaignId}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}
          >
            {recalculating ? "Recalculating…" : "Recalculate Scores"}
          </button>
        )}
        <button
          onClick={() => downloadCsv(candidatesToCsv(rows), `${activeCampaign?.name || "leaderboard"}.csv`)}
          disabled={rows.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Export CSV
        </button>
      </div>

      {activeCampaign && (
        <div className="rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-white/40 text-xs uppercase tracking-wide">Rewards</span>
          {activeCampaign.reward_items.map((item, i) => (
            <span key={i} className="text-sm px-3 py-1 rounded-full" style={{ background: "rgba(249,115,22,0.1)", color: "#F97316" }}>
              {item.label}{item.value ? ` — ${item.value}` : ""}
            </span>
          ))}
          <span className="text-white/30 text-xs ml-auto">
            Scoring: {activeCampaign.min_active_days}+ active days required · weights per-campaign
          </span>
        </div>
      )}

      <ChampionsLeaderboard
        rows={rows}
        loading={loading}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        showActions={canManage}
        onStatusChange={handleStatusChange}
        onAddNote={(id) => setNoteTarget(rows.find((r) => r.id === id) || null)}
      />

      <ConfirmDialog
        open={!!noteTarget}
        title={`Add internal note for ${noteTarget?.full_name || "this candidate"}`}
        requireReason
        reasonLabel="Note"
        confirmLabel="Save Note"
        onConfirm={handleAddNote}
        onCancel={() => setNoteTarget(null)}
      />
    </div>
  );
}
