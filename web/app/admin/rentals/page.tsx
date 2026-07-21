"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { approveListing, rejectListing, setFeatured, setSuspended, deleteListing } from "@/lib/services/ApprovalService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import TableToolbar from "@/components/admin/TableToolbar";
import BulkActionsBar from "@/components/admin/BulkActionsBar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

interface RentalVehicle {
  id: string;
  owner_id: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  price_per_day: number | null;
  location: string | null;
  contact_phone: string | null;
  photos: string[] | null;
  images: string[] | null;
  status: string;
  is_suspended: boolean;
  is_featured: boolean;
  is_available: boolean;
  created_at: string;
}

type Tab = "pending" | "approved" | "rejected" | "featured";
const PAGE_SIZE = 20;

export default function RentalsPage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<RentalVehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<RentalVehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RentalVehicle | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("rental_vehicles").select("*", { count: "exact" });
    if (tab === "featured") query = query.eq("is_featured", true);
    else query = query.eq("status", tab);
    if (search.trim()) query = query.or(`make.ilike.%${search}%,model.ilike.%${search}%,location.ilike.%${search}%`);
    query = query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count } = await query;
    setRows((data as RentalVehicle[]) || []);
    setTotal(count || 0);
    setSelected(new Set());
    setLoading(false);
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const getActorId = async () => (await supabase.auth.getUser()).data.user?.id || "";
  const vehicleName = (v: RentalVehicle) => [v.make, v.model].filter(Boolean).join(" ") || v.vehicle_type;

  const handleApprove = async (v: RentalVehicle) => {
    try { await approveListing("vehicles", v.id, v.owner_id, await getActorId()); showToast(`${vehicleName(v)} approved`); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleReject = async (reason?: string) => {
    if (!rejectTarget || !reason) return;
    try { await rejectListing("vehicles", rejectTarget.id, rejectTarget.owner_id, reason); showToast(`${vehicleName(rejectTarget)} rejected`); setRejectTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleFeature = async (v: RentalVehicle) => {
    try { await setFeatured("vehicles", v.id, !v.is_featured); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleSuspend = async (v: RentalVehicle) => {
    try { await setSuspended("vehicles", v.id, !v.is_suspended); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteListing("vehicles", deleteTarget.id, deleteTarget); showToast("Vehicle removed"); setDeleteTarget(null); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleBulkApprove = async () => {
    const actorId = await getActorId();
    for (const v of rows.filter((r) => selected.has(r.id))) await approveListing("vehicles", v.id, v.owner_id, actorId);
    showToast(`${selected.size} vehicles approved`);
    load();
  };

  const handleBulkReject = async (reason?: string) => {
    if (!reason) return;
    for (const v of rows.filter((r) => selected.has(r.id))) await rejectListing("vehicles", v.id, v.owner_id, reason);
    showToast(`${selected.size} vehicles rejected`);
    setBulkRejectOpen(false);
    load();
  };

  const columns: Column<RentalVehicle>[] = useMemo(() => [
    {
      key: "name", label: "Vehicle",
      render: (v) => {
        const photo = v.photos?.[0] || v.images?.[0];
        return (
          <Link href={`/admin/rentals/${v.id}`} className="flex items-center gap-3 hover:opacity-80">
            <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
              {photo && <img src={photo} alt="" className="w-full h-full object-cover" />}
            </div>
            <div>
              <div className="text-white font-medium">{vehicleName(v)}</div>
              <div className="text-white/30 text-xs">{v.location || "No location"}</div>
            </div>
          </Link>
        );
      },
    },
    { key: "type", label: "Type", render: (v) => <span className="text-white/60 capitalize">{v.vehicle_type}</span> },
    { key: "price", label: "Price/day", render: (v) => <span className="text-white/70">{v.price_per_day ? `₹${v.price_per_day.toLocaleString("en-IN")}` : "—"}</span> },
    { key: "owner", label: "Owner Contact", render: (v) => <span className="text-white/50 text-xs">{v.contact_phone || "—"}</span> },
    { key: "status", label: "Status", render: (v) => <div className="flex gap-1.5 flex-wrap"><StatusBadge status={v.status} />{v.is_suspended && <StatusBadge status="suspended" />}{v.is_featured && <span className="text-[11px]">⭐</span>}</div> },
    { key: "submitted", label: "Submitted", render: (v) => <span className="text-white/40 text-xs">{new Date(v.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span> },
    {
      key: "actions", label: "Actions",
      render: (v) => (
        <div className="flex gap-1.5 flex-wrap">
          <Link href={`/admin/rentals/${v.id}`} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>View Details</Link>
          {v.status === "pending" && hasPermission("rentals.approve") && (
            <>
              <ActionBtn onClick={() => handleApprove(v)}>Approve</ActionBtn>
              <ActionBtn danger onClick={() => setRejectTarget(v)}>Reject</ActionBtn>
            </>
          )}
          {hasPermission("featured.manage") && <ActionBtn onClick={() => handleToggleFeature(v)}>{v.is_featured ? "Unfeature" : "Feature"}</ActionBtn>}
          {hasPermission("rentals.edit") && <ActionBtn onClick={() => handleToggleSuspend(v)}>{v.is_suspended ? "Unsuspend" : "Suspend"}</ActionBtn>}
          {hasPermission("rentals.delete") && <ActionBtn danger onClick={() => setDeleteTarget(v)}>Delete</ActionBtn>}
        </div>
      ),
    },
  ], [hasPermission]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Rentals</h1>
          <p className="text-white/40 text-sm mt-0.5">Approve, feature, and manage rental vehicle listings. (Separate from the CMS Vehicles showcase catalog — see Migration Plan.)</p>
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

      <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search by make, model, or location…" />

      <BulkActionsBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          ...(tab === "pending" && hasPermission("rentals.approve") ? [
            { label: "Approve all", onClick: handleBulkApprove },
            { label: "Reject all", onClick: () => setBulkRejectOpen(true), danger: true },
          ] : []),
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage={`No ${tab} vehicles.`}
        selectable
        selectedIds={selected}
        onToggleSelect={(id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })}
        onToggleSelectAll={() => setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      <ConfirmDialog open={!!rejectTarget} title={`Reject ${rejectTarget ? vehicleName(rejectTarget) : "vehicle"}?`} requireReason
        reasonLabel="Rejection reason (shown to the owner)" confirmLabel="Reject" danger onConfirm={handleReject} onCancel={() => setRejectTarget(null)} />
      <ConfirmDialog open={bulkRejectOpen} title={`Reject ${selected.size} vehicles?`} requireReason
        reasonLabel="Rejection reason (shown to all selected)" confirmLabel="Reject all" danger onConfirm={handleBulkReject} onCancel={() => setBulkRejectOpen(false)} />
      <ConfirmDialog open={!!deleteTarget} title={`Permanently delete ${deleteTarget ? vehicleName(deleteTarget) : "this vehicle"}?`}
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
