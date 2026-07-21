"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { approveListing, rejectListing, setFeatured, setGuideActive, deleteListing } from "@/lib/services/ApprovalService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import TableToolbar from "@/components/admin/TableToolbar";
import BulkActionsBar from "@/components/admin/BulkActionsBar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

interface Guide {
  id: string;
  user_id: string;
  full_name: string | null;
  name: string | null;
  profile_photo_url: string | null;
  photo_url: string | null;
  location: string | null;
  experience: string | null;
  experience_years: number | null;
  rating: number | null;
  total_reviews: number | null;
  status: string;
  is_active: boolean;
  is_featured: boolean;
  identity_doc_front_url: string | null;
  identity_doc_back_url: string | null;
  rejection_reason: string | null;
  created_at: string;
}

type Tab = "pending" | "approved" | "rejected" | "featured";
const PAGE_SIZE = 20;

export default function GuidesPage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Guide[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<Guide | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Guide | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("guides").select("id, user_id, full_name, name, profile_photo_url, photo_url, location, experience, experience_years, rating, total_reviews, status, is_active, is_featured, identity_doc_front_url, identity_doc_back_url, rejection_reason, created_at", { count: "exact" });
    if (tab === "featured") query = query.eq("is_featured", true);
    else query = query.eq("status", tab);
    if (search.trim()) query = query.or(`full_name.ilike.%${search}%,name.ilike.%${search}%,location.ilike.%${search}%`);
    query = query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count } = await query;
    setRows((data as Guide[]) || []);
    setTotal(count || 0);
    setSelected(new Set());
    setLoading(false);
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const getActorId = async () => (await supabase.auth.getUser()).data.user?.id || "";

  const handleApprove = async (g: Guide) => {
    try {
      await approveListing("guides", g.id, g.user_id, await getActorId());
      showToast(`${g.full_name || g.name} approved`);
      load();
    } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleReject = async (reason?: string) => {
    if (!rejectTarget || !reason) return;
    try {
      await rejectListing("guides", rejectTarget.id, rejectTarget.user_id, reason);
      showToast(`${rejectTarget.full_name || rejectTarget.name} rejected`);
      setRejectTarget(null);
      load();
    } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleFeature = async (g: Guide) => {
    try { await setFeatured("guides", g.id, !g.is_featured); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleActive = async (g: Guide) => {
    try { await setGuideActive(g.id, !g.is_active); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteListing("guides", deleteTarget.id, deleteTarget);
      showToast("Guide removed");
      setDeleteTarget(null);
      load();
    } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleBulkApprove = async () => {
    const actorId = await getActorId();
    for (const g of rows.filter((r) => selected.has(r.id))) {
      await approveListing("guides", g.id, g.user_id, actorId);
    }
    showToast(`${selected.size} guides approved`);
    load();
  };

  const handleBulkReject = async (reason?: string) => {
    if (!reason) return;
    for (const g of rows.filter((r) => selected.has(r.id))) {
      await rejectListing("guides", g.id, g.user_id, reason);
    }
    showToast(`${selected.size} guides rejected`);
    setBulkRejectOpen(false);
    load();
  };

  const columns: Column<Guide>[] = useMemo(() => [
    {
      key: "name", label: "Guide",
      render: (g) => (
        <Link href={`/admin/guides/${g.id}`} className="flex items-center gap-3 hover:opacity-80">
          <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
            {(g.profile_photo_url || g.photo_url) && <img src={g.profile_photo_url || g.photo_url || ""} alt="" className="w-full h-full object-cover" />}
          </div>
          <div>
            <div className="text-white font-medium">{g.full_name || g.name || "Unnamed"}</div>
            <div className="text-white/30 text-xs">{g.location || "No location"}</div>
          </div>
        </Link>
      ),
    },
    { key: "experience", label: "Experience", render: (g) => <span className="text-white/60 text-xs">{g.experience || (g.experience_years ? `${g.experience_years}y` : "—")}</span> },
    { key: "rating", label: "Rating", render: (g) => <span className="text-white/70">{g.rating ? `★ ${g.rating.toFixed(1)}` : "—"} <span className="text-white/30">({g.total_reviews || 0})</span></span> },
    { key: "status", label: "Status", render: (g) => <div className="flex gap-1.5 flex-wrap"><StatusBadge status={g.status} />{!g.is_active && <StatusBadge status="suspended" />}{g.is_featured && <span className="text-[11px]">⭐</span>}</div> },
    { key: "submitted", label: "Submitted", render: (g) => <span className="text-white/40 text-xs">{new Date(g.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span> },
    {
      key: "actions", label: "Actions",
      render: (g) => (
        <div className="flex gap-1.5 flex-wrap">
          <Link href={`/admin/guides/${g.id}`} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>View Details</Link>
          {g.status === "pending" && hasPermission("guides.approve") && (
            <>
              <ActionBtn onClick={() => handleApprove(g)}>Approve</ActionBtn>
              <ActionBtn danger onClick={() => setRejectTarget(g)}>Reject</ActionBtn>
            </>
          )}
          {hasPermission("featured.manage") && <ActionBtn onClick={() => handleToggleFeature(g)}>{g.is_featured ? "Unfeature" : "Feature"}</ActionBtn>}
          {hasPermission("guides.edit") && <ActionBtn onClick={() => handleToggleActive(g)}>{g.is_active ? "Suspend" : "Unsuspend"}</ActionBtn>}
          {hasPermission("guides.delete") && <ActionBtn danger onClick={() => setDeleteTarget(g)}>Delete</ActionBtn>}
        </div>
      ),
    },
  ], [hasPermission]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Guides</h1>
          <p className="text-white/40 text-sm mt-0.5">Approve, feature, and manage guide profiles.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <div className="flex gap-2 mb-4">
        {(["pending", "approved", "rejected", "featured"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium capitalize"
            style={{ background: tab === t ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)", color: tab === t ? "#F97316" : "rgba(255,255,255,0.5)" }}>
            {t}
          </button>
        ))}
      </div>

      <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search by name or location…" />

      <BulkActionsBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          ...(tab === "pending" && hasPermission("guides.approve") ? [
            { label: "Approve all", onClick: handleBulkApprove },
            { label: "Reject all", onClick: () => setBulkRejectOpen(true), danger: true },
          ] : []),
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage={`No ${tab} guides.`}
        selectable
        selectedIds={selected}
        onToggleSelect={(id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })}
        onToggleSelectAll={() => setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!rejectTarget}
        title={`Reject ${rejectTarget?.full_name || rejectTarget?.name || "guide"}?`}
        requireReason
        reasonLabel="Rejection reason (shown to the guide)"
        confirmLabel="Reject"
        danger
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
      />
      <ConfirmDialog
        open={bulkRejectOpen}
        title={`Reject ${selected.size} guides?`}
        requireReason
        reasonLabel="Rejection reason (shown to all selected)"
        confirmLabel="Reject all"
        danger
        onConfirm={handleBulkReject}
        onCancel={() => setBulkRejectOpen(false)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Permanently delete ${deleteTarget?.full_name || deleteTarget?.name || "this guide"}?`}
        description="This removes the guide profile entirely. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
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
