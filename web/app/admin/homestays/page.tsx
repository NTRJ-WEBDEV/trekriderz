"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { approveListing, rejectListing, setFeatured, setSuspended, deleteListing } from "@/lib/services/ApprovalService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import TableToolbar from "@/components/admin/TableToolbar";
import BulkActionsBar from "@/components/admin/BulkActionsBar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

interface Property {
  id: string;
  owner_id: string;
  name: string;
  city: string | null;
  state: string | null;
  property_type: string | null;
  cover_photo_url: string | null;
  status: string;
  is_suspended: boolean;
  is_featured: boolean;
  commission_rate: number | null;
  identity_doc_front_url: string | null;
  ownership_proof_url: string | null;
  rejection_reason: string | null;
}

type Tab = "pending" | "approved" | "rejected" | "featured";
const PAGE_SIZE = 20;

export default function HomestaysPage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("properties").select("*", { count: "exact" });
    if (tab === "featured") query = query.eq("is_featured", true);
    else query = query.eq("status", tab);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
    query = query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count } = await query;
    setRows((data as Property[]) || []);
    setTotal(count || 0);
    setSelected(new Set());
    setLoading(false);
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const getActorId = async () => (await supabase.auth.getUser()).data.user?.id || "";

  const handleApprove = async (p: Property) => {
    try { await approveListing("homestays", p.id, p.owner_id, await getActorId()); showToast(`${p.name} approved`); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleReject = async (reason?: string) => {
    if (!rejectTarget || !reason) return;
    try { await rejectListing("homestays", rejectTarget.id, rejectTarget.owner_id, reason); showToast(`${rejectTarget.name} rejected`); setRejectTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleFeature = async (p: Property) => {
    try { await setFeatured("homestays", p.id, !p.is_featured); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleSuspend = async (p: Property) => {
    try { await setSuspended("homestays", p.id, !p.is_suspended); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteListing("homestays", deleteTarget.id, deleteTarget); showToast("Homestay removed"); setDeleteTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleBulkApprove = async () => {
    const actorId = await getActorId();
    for (const p of rows.filter((r) => selected.has(r.id))) await approveListing("homestays", p.id, p.owner_id, actorId);
    showToast(`${selected.size} homestays approved`);
    load();
  };

  const handleBulkReject = async (reason?: string) => {
    if (!reason) return;
    for (const p of rows.filter((r) => selected.has(r.id))) await rejectListing("homestays", p.id, p.owner_id, reason);
    showToast(`${selected.size} homestays rejected`);
    setBulkRejectOpen(false);
    load();
  };

  const columns: Column<Property>[] = useMemo(() => [
    {
      key: "name", label: "Homestay",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
            {p.cover_photo_url && <img src={p.cover_photo_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div>
            <div className="text-white font-medium">{p.name}</div>
            <div className="text-white/30 text-xs">{[p.city, p.state].filter(Boolean).join(", ") || "No location"}</div>
          </div>
        </div>
      ),
    },
    { key: "type", label: "Type", render: (p) => <span className="text-white/60 capitalize">{p.property_type || "—"}</span> },
    { key: "commission", label: "Commission", render: (p) => <span className="text-white/60">{p.commission_rate != null ? `${p.commission_rate}%` : "—"}</span> },
    { key: "status", label: "Status", render: (p) => <div className="flex gap-1.5 flex-wrap"><StatusBadge status={p.status} />{p.is_suspended && <StatusBadge status="suspended" />}{p.is_featured && <span className="text-[11px]">⭐</span>}</div> },
    { key: "docs", label: "Documents", render: (p) => (
      <div className="flex gap-2 text-xs">
        {p.identity_doc_front_url ? <a href={p.identity_doc_front_url} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "#F97316" }}>ID</a> : <span className="text-white/20">ID</span>}
        {p.ownership_proof_url ? <a href={p.ownership_proof_url} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "#F97316" }}>Ownership</a> : <span className="text-white/20">Ownership</span>}
      </div>
    ) },
    {
      key: "actions", label: "Actions",
      render: (p) => (
        <div className="flex gap-1.5 flex-wrap">
          {p.status === "pending" && hasPermission("homestays.approve") && (
            <>
              <ActionBtn onClick={() => handleApprove(p)}>Approve</ActionBtn>
              <ActionBtn danger onClick={() => setRejectTarget(p)}>Reject</ActionBtn>
            </>
          )}
          {hasPermission("featured.manage") && <ActionBtn onClick={() => handleToggleFeature(p)}>{p.is_featured ? "Unfeature" : "Feature"}</ActionBtn>}
          {hasPermission("homestays.edit") && <ActionBtn onClick={() => handleToggleSuspend(p)}>{p.is_suspended ? "Unsuspend" : "Suspend"}</ActionBtn>}
          {hasPermission("homestays.delete") && <ActionBtn danger onClick={() => setDeleteTarget(p)}>Delete</ActionBtn>}
        </div>
      ),
    },
  ], [hasPermission]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Homestays</h1>
          <p className="text-white/40 text-sm mt-0.5">Approve, feature, and manage homestay listings.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <div className="flex gap-2 mb-4">
        {(["pending", "approved", "rejected", "featured"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm font-medium capitalize"
            style={{ background: tab === t ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)", color: tab === t ? "#F97316" : "rgba(255,255,255,0.5)" }}>
            {t}
          </button>
        ))}
      </div>

      <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search by name or city…" />

      <BulkActionsBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          ...(tab === "pending" && hasPermission("homestays.approve") ? [
            { label: "Approve all", onClick: handleBulkApprove },
            { label: "Reject all", onClick: () => setBulkRejectOpen(true), danger: true },
          ] : []),
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage={`No ${tab} homestays.`}
        selectable
        selectedIds={selected}
        onToggleSelect={(id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })}
        onToggleSelectAll={() => setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      <ConfirmDialog open={!!rejectTarget} title={`Reject ${rejectTarget?.name || "homestay"}?`} requireReason
        reasonLabel="Rejection reason (shown to the owner)" confirmLabel="Reject" danger onConfirm={handleReject} onCancel={() => setRejectTarget(null)} />
      <ConfirmDialog open={bulkRejectOpen} title={`Reject ${selected.size} homestays?`} requireReason
        reasonLabel="Rejection reason (shown to all selected)" confirmLabel="Reject all" danger onConfirm={handleBulkReject} onCancel={() => setBulkRejectOpen(false)} />
      <ConfirmDialog open={!!deleteTarget} title={`Permanently delete ${deleteTarget?.name || "this homestay"}?`}
        description="This removes the listing entirely. This cannot be undone." confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
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
