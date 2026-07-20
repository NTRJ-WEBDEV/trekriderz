"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { hideContent, restoreContent, deleteContent, warnUser, suspendUser, banUser, ModeratableEntity } from "@/lib/services/ModerationService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import TableToolbar from "@/components/admin/TableToolbar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

interface ContentRow {
  id: string;
  user_id: string;
  content?: string | null;
  caption?: string | null;
  media?: string[] | null;
  media_url?: string | null;
  post_type?: string | null;
  moderation_status?: string | null;
  is_hidden?: boolean | null;
  created_at: string;
  users?: { full_name: string | null; email: string | null } | null;
}

type Tab = "posts" | "reels" | "travel_stories" | "stories_24h" | "comments" | "reported";

const TAB_CONFIG: Record<Exclude<Tab, "reported">, { table: string; entity: ModeratableEntity; extraFilter?: [string, string]; label: string }> = {
  posts: { table: "posts", entity: "posts", extraFilter: ["post_type", "is.null"], label: "Posts" },
  reels: { table: "posts", entity: "posts", extraFilter: ["post_type", "eq.reel"], label: "Reels" },
  travel_stories: { table: "posts", entity: "posts", extraFilter: ["post_type", "eq.trip_story"], label: "Travel Stories" },
  stories_24h: { table: "stories_24h", entity: "stories_24h", label: "Stories (24h)" },
  comments: { table: "post_comments", entity: "post_comments", label: "Comments" },
};

const PAGE_SIZE = 20;

export default function ModerationPage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("posts");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hideTarget, setHideTarget] = useState<ContentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentRow | null>(null);
  const [warnTarget, setWarnTarget] = useState<ContentRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ContentRow | null>(null);
  const [banTarget, setBanTarget] = useState<ContentRow | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    if (tab === "reported") return;
    setLoading(true);
    const cfg = TAB_CONFIG[tab];
    let query = supabase.from(cfg.table).select("*, users(full_name, email)", { count: "exact" });
    if (cfg.extraFilter) {
      const [col, val] = cfg.extraFilter;
      query = val === "is.null" ? query.is(col, null) : query.eq(col, val.replace("eq.", ""));
    }
    if (search.trim()) {
      const textCol = tab === "stories_24h" ? "caption" : tab === "comments" ? "content" : "content";
      query = query.ilike(textCol, `%${search}%`);
    }
    query = query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count } = await query;
    setRows((data as any) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const isHidden = (row: ContentRow, entity: ModeratableEntity) => entity === "posts" ? row.moderation_status === "hidden" : !!row.is_hidden;

  const handleHide = async (reason?: string) => {
    if (!hideTarget || !reason) return;
    const cfg = TAB_CONFIG[tab as Exclude<Tab, "reported">];
    try { await hideContent(cfg.entity, hideTarget.id, reason); showToast("Content hidden"); setHideTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleRestore = async (row: ContentRow) => {
    const cfg = TAB_CONFIG[tab as Exclude<Tab, "reported">];
    try { await restoreContent(cfg.entity, row.id); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const cfg = TAB_CONFIG[tab as Exclude<Tab, "reported">];
    try { await deleteContent(cfg.entity, deleteTarget.id, deleteTarget); showToast("Content deleted"); setDeleteTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleWarn = async (reason?: string) => {
    if (!warnTarget || !reason) return;
    try { await warnUser(warnTarget.user_id, reason); showToast("User warned"); setWarnTarget(null); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleSuspend = async (reason?: string) => {
    if (!suspendTarget || !reason) return;
    try { await suspendUser(suspendTarget.user_id, reason); showToast("User suspended 7 days"); setSuspendTarget(null); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleBan = async (reason?: string) => {
    if (!banTarget || !reason) return;
    try { await banUser(banTarget.user_id, reason); showToast("User permanently banned"); setBanTarget(null); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const columns: Column<ContentRow>[] = useMemo(() => {
    if (tab === "reported") return [];
    const cfg = TAB_CONFIG[tab as Exclude<Tab, "reported">];
    return [
      {
        key: "preview", label: "Preview",
        render: (r) => (
          <div className="max-w-xs">
            <div className="text-white text-sm truncate">{r.content || r.caption || "(no text)"}</div>
            <div className="text-white/30 text-xs">{new Date(r.created_at).toLocaleDateString("en-IN")}</div>
          </div>
        ),
      },
      { key: "owner", label: "Owner", render: (r) => <span className="text-white/60 text-sm">{r.users?.full_name || r.users?.email || "Unknown"}</span> },
      { key: "status", label: "Status", render: (r) => <StatusBadge status={isHidden(r, cfg.entity) ? "suspended" : "approved"} /> },
      {
        key: "actions", label: "Actions",
        render: (r) => (
          <div className="flex gap-1.5 flex-wrap">
            {!isHidden(r, cfg.entity) && hasPermission("reels.moderate") && <ActionBtn onClick={() => setHideTarget(r)}>Hide</ActionBtn>}
            {isHidden(r, cfg.entity) && hasPermission("reels.moderate") && <ActionBtn onClick={() => handleRestore(r)}>Restore</ActionBtn>}
            {hasPermission("posts.delete") && <ActionBtn danger onClick={() => setDeleteTarget(r)}>Delete</ActionBtn>}
            {hasPermission("users.ban") && <ActionBtn onClick={() => setWarnTarget(r)}>Warn</ActionBtn>}
            {hasPermission("users.ban") && <ActionBtn danger onClick={() => setSuspendTarget(r)}>Suspend</ActionBtn>}
            {hasPermission("users.ban") && <ActionBtn danger onClick={() => setBanTarget(r)}>Ban</ActionBtn>}
          </div>
        ),
      },
    ];
  }, [tab, hasPermission]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "posts", label: "Posts" }, { key: "reels", label: "Reels" }, { key: "travel_stories", label: "Travel Stories" },
    { key: "stories_24h", label: "Stories" }, { key: "comments", label: "Comments" }, { key: "reported", label: "Reported Content" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Content Moderation</h1>
          <p className="text-white/40 text-sm mt-0.5">Hide, restore, delete content, and warn/suspend/ban users.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: tab === t.key ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)", color: tab === t.key ? "#F97316" : "rgba(255,255,255,0.5)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "reported" ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-white/50 text-sm mb-4">Reported posts and reported stories/community content share one combined view — the Reports Center, not a duplicate table here.</p>
          <Link href="/admin/reports" className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#F97316" }}>Open Reports Center</Link>
        </div>
      ) : (
        <>
          <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search content…" />
          <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="Nothing here." page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog open={!!hideTarget} title="Hide this content?" requireReason reasonLabel="Reason" confirmLabel="Hide" danger onConfirm={handleHide} onCancel={() => setHideTarget(null)} />
      <ConfirmDialog open={!!deleteTarget} title="Permanently delete this content?" description="This cannot be undone." confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!warnTarget} title="Send a warning to this user?" requireReason reasonLabel="Warning message" confirmLabel="Send Warning" onConfirm={handleWarn} onCancel={() => setWarnTarget(null)} />
      <ConfirmDialog open={!!suspendTarget} title="Suspend this user for 7 days?" requireReason reasonLabel="Reason" confirmLabel="Suspend" danger onConfirm={handleSuspend} onCancel={() => setSuspendTarget(null)} />
      <ConfirmDialog open={!!banTarget} title="Permanently ban this user?" description="This blocks the account indefinitely." requireReason reasonLabel="Reason" confirmLabel="Ban Permanently" danger onConfirm={handleBan} onCancel={() => setBanTarget(null)} />
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
