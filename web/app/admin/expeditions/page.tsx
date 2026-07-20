"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/services/AuditService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import TableToolbar from "@/components/admin/TableToolbar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

interface Expedition {
  id: string;
  guide_id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  difficulty: string;
  max_seats: number;
  booked_seats: number;
  status: string;
  is_featured: boolean;
  guides?: { full_name: string | null; name: string | null } | null;
}

// No dedicated "archived" status exists on guided_expeditions (CHECK only
// allows draft/published/full/ongoing/completed/cancelled) — Archive maps
// to 'cancelled', the closest existing state, rather than adding a new
// enum value for one button label.
const STATUS_TABS = ["draft", "published", "ongoing", "completed", "cancelled", "featured"] as const;
type Tab = typeof STATUS_TABS[number];
const PAGE_SIZE = 20;

export default function ExpeditionsPage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("published");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Expedition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Expedition | null>(null);
  const [bookingsTarget, setBookingsTarget] = useState<Expedition | null>(null);
  const [bookingCount, setBookingCount] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("guided_expeditions").select("*, guides(full_name, name)", { count: "exact" });
    if (tab === "featured") query = query.eq("is_featured", true);
    else query = query.eq("status", tab);
    if (search.trim()) query = query.or(`title.ilike.%${search}%,destination.ilike.%${search}%`);
    query = query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count } = await query;
    setRows((data as any) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [tab, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const setStatus = async (e: Expedition, status: string) => {
    const { error } = await supabase.from("guided_expeditions").update({ status }).eq("id", e.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: `expeditions.${status}`, entityType: "expeditions", entityId: e.id, previousValue: { status: e.status }, newValue: { status } });
    showToast(`"${e.title}" is now ${status}`);
    load();
  };

  const toggleFeature = async (e: Expedition) => {
    const { error } = await supabase.from("guided_expeditions").update({ is_featured: !e.is_featured }).eq("id", e.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: e.is_featured ? "expeditions.unfeatured" : "expeditions.featured", entityType: "expeditions", entityId: e.id, newValue: { is_featured: !e.is_featured } });
    load();
  };

  const duplicate = async (e: Expedition) => {
    const { data: full } = await supabase.from("guided_expeditions").select("*").eq("id", e.id).single();
    if (!full) return;
    const { id, created_at, updated_at, booked_seats, ...rest } = full;
    const { data: inserted, error } = await supabase.from("guided_expeditions").insert({ ...rest, title: `${full.title} (Copy)`, status: "draft", booked_seats: 0 }).select("id").single();
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: "expeditions.duplicated", entityType: "expeditions", entityId: inserted?.id, metadata: { duplicated_from: e.id } });
    showToast(`Duplicated as draft`);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("guided_expeditions").delete().eq("id", deleteTarget.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: "expeditions.deleted", entityType: "expeditions", entityId: deleteTarget.id, previousValue: deleteTarget });
    showToast("Expedition deleted");
    setDeleteTarget(null);
    load();
  };

  const openBookings = async (e: Expedition) => {
    setBookingsTarget(e);
    const { count } = await supabase.from("expedition_bookings").select("id", { count: "exact", head: true }).eq("expedition_id", e.id);
    setBookingCount(count || 0);
  };

  const columns: Column<Expedition>[] = useMemo(() => [
    {
      key: "title", label: "Expedition",
      render: (e) => (
        <div>
          <div className="text-white font-medium">{e.title}</div>
          <div className="text-white/30 text-xs">{e.destination} · by {e.guides?.full_name || e.guides?.name || "Unknown guide"}</div>
        </div>
      ),
    },
    { key: "dates", label: "Dates", render: (e) => <span className="text-white/60 text-xs">{e.start_date} → {e.end_date}</span> },
    { key: "difficulty", label: "Difficulty", render: (e) => <span className="text-white/60 capitalize">{e.difficulty}</span> },
    { key: "seats", label: "Seats", render: (e) => <span className="text-white/60">{e.booked_seats}/{e.max_seats}</span> },
    { key: "status", label: "Status", render: (e) => <div className="flex gap-1.5 items-center"><StatusBadge status={e.status} />{e.is_featured && <span className="text-[11px]">⭐</span>}</div> },
    {
      key: "actions", label: "Actions",
      render: (e) => (
        <div className="flex gap-1.5 flex-wrap">
          {hasPermission("expeditions.manage") && e.status === "draft" && <ActionBtn onClick={() => setStatus(e, "published")}>Publish</ActionBtn>}
          {hasPermission("expeditions.manage") && e.status === "published" && <ActionBtn onClick={() => setStatus(e, "draft")}>Unpublish</ActionBtn>}
          {hasPermission("expeditions.manage") && !["cancelled", "completed"].includes(e.status) && <ActionBtn onClick={() => setStatus(e, "cancelled")}>Archive</ActionBtn>}
          {hasPermission("expeditions.manage") && <ActionBtn onClick={() => duplicate(e)}>Duplicate</ActionBtn>}
          {hasPermission("featured.manage") && <ActionBtn onClick={() => toggleFeature(e)}>{e.is_featured ? "Unfeature" : "Feature"}</ActionBtn>}
          <ActionBtn onClick={() => openBookings(e)}>Bookings</ActionBtn>
          {hasPermission("expeditions.manage") && <ActionBtn danger onClick={() => setDeleteTarget(e)}>Delete</ActionBtn>}
        </div>
      ),
    },
  ], [hasPermission]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Expeditions</h1>
          <p className="text-white/40 text-sm mt-0.5">Publish, feature, and manage guide-hosted expeditions.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm font-medium capitalize"
            style={{ background: tab === t ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)", color: tab === t ? "#F97316" : "rgba(255,255,255,0.5)" }}>
            {t}
          </button>
        ))}
      </div>

      <TableToolbar search={search} onSearchChange={setSearch} placeholder="Search by title or destination…" />

      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage={`No ${tab} expeditions.`} page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <ConfirmDialog open={!!deleteTarget} title={`Permanently delete "${deleteTarget?.title}"?`}
        description="This cannot be undone." confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {bookingsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setBookingsTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#0F1420", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-base mb-1">{bookingsTarget.title}</h3>
            <p className="text-white/50 text-sm mb-4">{bookingCount === null ? "Loading…" : `${bookingCount} booking${bookingCount === 1 ? "" : "s"} · ${bookingsTarget.booked_seats}/${bookingsTarget.max_seats} seats filled`}</p>
            <button onClick={() => setBookingsTarget(null)} className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#F97316" }}>Close</button>
          </div>
        </div>
      )}
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
