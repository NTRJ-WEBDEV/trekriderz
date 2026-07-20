"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/services/AuditService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import TableToolbar from "@/components/admin/TableToolbar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  category: string | null;
  created_by: string;
  member_count: number;
  is_private: boolean;
  is_suspended: boolean;
  is_featured: boolean;
}

// communities has no `status`/pending-approval column — creation is
// immediate today (no gate to approve from), so this page manages what the
// schema actually supports: suspend, feature, delete. Approve/Reject was
// requested in the spec but would need a real pending-state creation flow
// first (a mobile-app UX change, out of scope here) — see Migration Plan.
type Tab = "all" | "suspended" | "featured";
const PAGE_SIZE = 20;

export default function CommunitiesPage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Community[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Community | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("communities").select("*", { count: "exact" });
    if (tab === "suspended") query = query.eq("is_suspended", true);
    else if (tab === "featured") query = query.eq("is_featured", true);
    if (search.trim()) query = query.ilike("name", `%${search}%`);
    query = query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count } = await query;
    setRows((data as Community[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const toggleSuspend = async (c: Community) => {
    const { error } = await supabase.from("communities").update({ is_suspended: !c.is_suspended }).eq("id", c.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: c.is_suspended ? "communities.unsuspended" : "communities.suspended", entityType: "communities", entityId: c.id, newValue: { is_suspended: !c.is_suspended } });
    load();
  };

  const toggleFeature = async (c: Community) => {
    const { error } = await supabase.from("communities").update({ is_featured: !c.is_featured }).eq("id", c.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: c.is_featured ? "communities.unfeatured" : "communities.featured", entityType: "communities", entityId: c.id, newValue: { is_featured: !c.is_featured } });
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("communities").delete().eq("id", deleteTarget.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: "communities.deleted", entityType: "communities", entityId: deleteTarget.id, previousValue: deleteTarget });
    showToast("Community deleted");
    setDeleteTarget(null);
    load();
  };

  const columns: Column<Community>[] = useMemo(() => [
    {
      key: "name", label: "Community",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
            {c.cover_image && <img src={c.cover_image} alt="" className="w-full h-full object-cover" />}
          </div>
          <div>
            <div className="text-white font-medium">{c.name}</div>
            <div className="text-white/30 text-xs capitalize">{c.category || "general"} · {c.is_private ? "Private" : "Public"}</div>
          </div>
        </div>
      ),
    },
    { key: "members", label: "Members", render: (c) => <span className="text-white/70">{c.member_count}</span> },
    { key: "status", label: "Status", render: (c) => <div className="flex gap-1.5 items-center">{c.is_suspended && <StatusBadge status="suspended" />}{c.is_featured && <span className="text-[11px]">⭐</span>}{!c.is_suspended && !c.is_featured && <span className="text-white/30 text-xs">Active</span>}</div> },
    {
      key: "actions", label: "Actions",
      render: (c) => (
        <div className="flex gap-1.5 flex-wrap">
          {hasPermission("communities.approve") && <ActionBtn onClick={() => toggleSuspend(c)}>{c.is_suspended ? "Unsuspend" : "Suspend"}</ActionBtn>}
          {hasPermission("featured.manage") && <ActionBtn onClick={() => toggleFeature(c)}>{c.is_featured ? "Unfeature" : "Feature"}</ActionBtn>}
          {hasPermission("communities.manage") && <ActionBtn danger onClick={() => setDeleteTarget(c)}>Delete</ActionBtn>}
        </div>
      ),
    },
  ], [hasPermission]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Communities</h1>
          <p className="text-white/40 text-sm mt-0.5">Suspend, feature, and manage communities.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "suspended", "featured"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm font-medium capitalize"
            style={{ background: tab === t ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)", color: tab === t ? "#F97316" : "rgba(255,255,255,0.5)" }}>
            {t}
          </button>
        ))}
      </div>

      <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search by name…" />

      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No communities found." page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <ConfirmDialog open={!!deleteTarget} title={`Permanently delete "${deleteTarget?.name}"?`}
        description="This removes the community and its membership records. This cannot be undone." confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
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
