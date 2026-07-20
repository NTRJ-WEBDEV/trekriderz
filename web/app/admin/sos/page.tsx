"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/services/AuditService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface SosAlert {
  id: string;
  trip_id: string;
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  trips: { title: string } | null;
  users: { full_name: string | null; email: string | null } | null;
}

export default function SosCenterPage() {
  const supabase = createClient();
  const { hasPermission } = useAdminPermissions();
  const [rows, setRows] = useState<SosAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<SosAlert | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sos_alerts")
      .select("*, trips:trip_id(title), users:user_id(full_name, email)")
      .order("created_at", { ascending: false });
    setRows((data as any[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async () => {
    if (!resolveTarget) return;
    const { error } = await supabase
      .from("sos_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", resolveTarget.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({
      action: "sos_alerts.resolved", entityType: "sos_alert", entityId: resolveTarget.id,
      previousValue: { status: "active" }, newValue: { status: "resolved" },
    });
    showToast("SOS alert marked resolved.");
    setResolveTarget(null);
    load();
  };

  const columns: Column<SosAlert>[] = [
    { key: "user", label: "User", render: (r) => <div><div className="text-white">{r.users?.full_name || "Unknown"}</div><div className="text-white/30 text-xs">{r.users?.email}</div></div> },
    { key: "trip", label: "Trip", render: (r) => <span className="text-white/70">{r.trips?.title || "—"}</span> },
    { key: "location", label: "Location", render: (r) => r.latitude && r.longitude ? <span className="text-white/50 text-xs">{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</span> : <span className="text-white/20">—</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "raised", label: "Raised", render: (r) => <span className="text-white/40 text-xs">{new Date(r.created_at).toLocaleString("en-IN")}</span> },
    {
      key: "actions", label: "Actions",
      render: (r) => r.status === "active" && hasPermission("sos.manage") ? (
        <button
          onClick={() => setResolveTarget(r)}
          className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
          style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
        >
          Mark Resolved
        </button>
      ) : null,
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">SOS Center</h1>
          <p className="text-white/40 text-sm mt-0.5">Active and resolved safety alerts raised on trips.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="No SOS alerts recorded." />

      <ConfirmDialog
        open={!!resolveTarget}
        title={`Mark this SOS alert resolved?`}
        description="This confirms the situation has been handled and clears it from the Operations Inbox."
        confirmLabel="Mark Resolved"
        onConfirm={handleResolve}
        onCancel={() => setResolveTarget(null)}
      />
    </div>
  );
}
