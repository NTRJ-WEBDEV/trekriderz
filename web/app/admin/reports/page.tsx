"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { deleteContent, warnUser, suspendUser, banUser } from "@/lib/services/ModerationService";
import { logAdminAction } from "@/lib/services/AuditService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import TableToolbar from "@/components/admin/TableToolbar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

// One combined view over post_reports + content_reports — the two tables
// this admin UI never had before Phase 3 (per the Phase 1 audit: "No
// moderation for posts/reels/comments/user reports" on web).
interface ReportRow {
  id: string;
  source: "post_reports" | "content_reports";
  reporter_id: string;
  reporterName: string;
  reason: string;
  status: string;
  created_at: string;
  targetType: string;
  targetId: string | null;
  targetPreview: string;
  targetOwnerId: string | null;
}

type Tab = "pending" | "dismissed" | "actioned";
const PAGE_SIZE = 20;

export default function ReportsPage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [warnTarget, setWarnTarget] = useState<ReportRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ReportRow | null>(null);
  const [banTarget, setBanTarget] = useState<ReportRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportRow | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: postReports }, { data: contentReports }] = await Promise.all([
      supabase.from("post_reports").select("*, reporter:users(full_name, email), post:posts(id, content, user_id)").eq("status", tab).order("created_at", { ascending: false }).limit(50),
      supabase.from("content_reports").select("*, reporter:users(full_name, email)").eq("status", tab).order("created_at", { ascending: false }).limit(50),
    ]);

    const postRows: ReportRow[] = ((postReports as any[]) || []).map((r) => ({
      id: r.id, source: "post_reports", reporter_id: r.reporter_id,
      reporterName: r.reporter?.full_name || r.reporter?.email || "Unknown",
      reason: r.reason, status: r.status, created_at: r.created_at,
      targetType: "post", targetId: r.post?.id || r.post_id,
      targetPreview: r.post?.content ? r.post.content.slice(0, 80) : "(post unavailable)",
      targetOwnerId: r.post?.user_id || null,
    }));
    const contentRows: ReportRow[] = ((contentReports as any[]) || []).map((r) => ({
      id: r.id, source: "content_reports", reporter_id: r.reporter_id,
      reporterName: r.reporter?.full_name || r.reporter?.email || "Unknown",
      reason: r.reason, status: r.status, created_at: r.created_at,
      targetType: r.content_type, targetId: r.content_id, targetPreview: `${r.content_type} #${(r.content_id || "").slice(0, 8)}`,
      targetOwnerId: null,
    }));

    let combined = [...postRows, ...contentRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (search.trim()) {
      const q = search.toLowerCase();
      combined = combined.filter((r) => r.reason.toLowerCase().includes(q) || r.reporterName.toLowerCase().includes(q) || r.targetPreview.toLowerCase().includes(q));
    }
    setRows(combined);
    setLoading(false);
  }, [tab, search]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (r: ReportRow, status: string) => {
    const { error } = await supabase.from(r.source).update({ status }).eq("id", r.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: `report.${status}`, entityType: r.source, entityId: r.id, newValue: { status } });
  };

  const handleDismiss = async (r: ReportRow) => {
    await updateStatus(r, "dismissed");
    showToast("Report dismissed");
    load();
  };

  const handleDeleteContent = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.source === "post_reports") {
        await deleteContent("posts", deleteTarget.targetId || "", { report_id: deleteTarget.id });
      } else if (deleteTarget.targetType === "story") {
        await deleteContent("stories_24h", deleteTarget.targetId || "", { report_id: deleteTarget.id });
      } else {
        // community_posts — same is_hidden pattern mobile's admin already
        // uses for this content_type; not a ModeratableEntity here since
        // it's a distinct, unaudited table shape.
        await supabase.from("community_posts").update({ is_hidden: true }).eq("id", deleteTarget.targetId);
        await logAdminAction({ action: "community_posts.hidden", entityType: "community_posts", entityId: deleteTarget.targetId || undefined });
      }
      await updateStatus(deleteTarget, "actioned");
      showToast("Content removed");
      setDeleteTarget(null);
      load();
    } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleWarn = async (reason?: string) => {
    if (!warnTarget?.targetOwnerId || !reason) return;
    try { await warnUser(warnTarget.targetOwnerId, reason); await updateStatus(warnTarget, "actioned"); showToast("User warned"); setWarnTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleSuspend = async (reason?: string) => {
    if (!suspendTarget?.targetOwnerId || !reason) return;
    try { await suspendUser(suspendTarget.targetOwnerId, reason); await updateStatus(suspendTarget, "actioned"); showToast("User suspended"); setSuspendTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleBan = async (reason?: string) => {
    if (!banTarget?.targetOwnerId || !reason) return;
    try { await banUser(banTarget.targetOwnerId, reason); await updateStatus(banTarget, "actioned"); showToast("User banned"); setBanTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const columns: Column<ReportRow>[] = useMemo(() => [
    { key: "target", label: "Target", render: (r) => (
      <div className="max-w-xs">
        <div className="text-white text-sm truncate">{r.targetPreview}</div>
        <div className="text-white/30 text-xs capitalize">{r.targetType}</div>
      </div>
    ) },
    { key: "reporter", label: "Reporter", render: (r) => <span className="text-white/60 text-sm">{r.reporterName}</span> },
    { key: "reason", label: "Reason", render: (r) => <span className="text-white/70 text-sm">{r.reason}</span> },
    { key: "created", label: "Created", render: (r) => <span className="text-white/40 text-xs">{new Date(r.created_at).toLocaleDateString("en-IN")}</span> },
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div className="flex gap-1.5 flex-wrap">
          {tab === "pending" && hasPermission("reports.resolve") && (
            <>
              <ActionBtn onClick={() => handleDismiss(r)}>Dismiss</ActionBtn>
              <ActionBtn danger onClick={() => setDeleteTarget(r)}>Delete Content</ActionBtn>
              {r.targetOwnerId && (
                <>
                  <ActionBtn onClick={() => setWarnTarget(r)}>Warn</ActionBtn>
                  <ActionBtn danger onClick={() => setSuspendTarget(r)}>Suspend</ActionBtn>
                  <ActionBtn danger onClick={() => setBanTarget(r)}>Ban</ActionBtn>
                </>
              )}
            </>
          )}
        </div>
      ),
    },
  ], [tab, hasPermission]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Reports Center</h1>
          <p className="text-white/40 text-sm mt-0.5">Post reports and content reports, combined.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <div className="flex gap-2 mb-4">
        {(["pending", "actioned", "dismissed"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm font-medium capitalize"
            style={{ background: tab === t ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)", color: tab === t ? "#F97316" : "rgba(255,255,255,0.5)" }}>
            {t === "pending" ? "Open" : t}
          </button>
        ))}
      </div>

      <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search by reason, reporter, or target…" />

      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage={`No ${tab === "pending" ? "open" : tab} reports.`} />

      <ConfirmDialog open={!!deleteTarget} title="Delete the reported content?" description="This removes it and marks the report as actioned." confirmLabel="Delete" danger onConfirm={handleDeleteContent} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!warnTarget} title="Warn the content owner?" requireReason reasonLabel="Warning message" confirmLabel="Send Warning" onConfirm={handleWarn} onCancel={() => setWarnTarget(null)} />
      <ConfirmDialog open={!!suspendTarget} title="Suspend the content owner for 7 days?" requireReason reasonLabel="Reason" confirmLabel="Suspend" danger onConfirm={handleSuspend} onCancel={() => setSuspendTarget(null)} />
      <ConfirmDialog open={!!banTarget} title="Permanently ban the content owner?" requireReason reasonLabel="Reason" confirmLabel="Ban Permanently" danger onConfirm={handleBan} onCancel={() => setBanTarget(null)} />
    </div>
  );
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
      style={{ background: danger ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)", color: danger ? "#EF4444" : "#fff" }}>
      {children}
    </button>
  );
}
