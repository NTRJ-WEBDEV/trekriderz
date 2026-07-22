"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAdminPermissions } from "@/lib/adminPermissions";
import { createClient } from "@/lib/supabase";
import DataTable, { Column } from "@/components/admin/DataTable";
import RecordAuditModal from "@/components/admin/review/RecordAuditModal";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  fetchAuditQueue, recordAuditOutcome, sendReminderNow, hideOverdueListing,
  type AuditQueueRow, type AuditType, type AuditChecklist, type AuditOutcome,
} from "@/lib/services/AuditWorkspaceService";
import type { ApprovalEntity } from "@/lib/services/ApprovalService";

const ENTITY_ROUTE: Record<ApprovalEntity, string> = { guides: "/admin/guides", homestays: "/admin/homestays", vehicles: "/admin/rentals" };
const ENTITY_LABEL: Record<ApprovalEntity, string> = { guides: "Guide", homestays: "Homestay", vehicles: "Rental" };

const TIER_COLOR: Record<string, string> = {
  overdue: "#EF4444", "1d": "#EF4444", "7d": "#F59E0B", "14d": "#F59E0B", "30d": "#9CA3AF", "60d": "#9CA3AF",
};
const TIER_LABEL: Record<string, string> = {
  overdue: "Overdue", "1d": "Due tomorrow", "7d": "Due this week", "14d": "Due in 2 weeks", "30d": "Due in a month", "60d": "Due in 2 months",
};

export default function AuditsQueuePage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [rows, setRows] = useState<AuditQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "overdue" | "due_soon">("all");
  const [auditTarget, setAuditTarget] = useState<AuditQueueRow | null>(null);
  const [hideTarget, setHideTarget] = useState<AuditQueueRow | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const canManage = (entityType: ApprovalEntity) =>
    entityType === "guides" ? hasPermission("guides.approve") : entityType === "homestays" ? hasPermission("homestays.approve") : hasPermission("rentals.approve");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAuditQueue();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === "overdue") return rows.filter((r) => r.reminderTier === "overdue");
    if (filter === "due_soon") return rows.filter((r) => r.reminderTier && r.reminderTier !== "overdue");
    return rows;
  }, [rows, filter]);

  const handleRecordAudit = async (input: { audit_type: AuditType; checklist: AuditChecklist; photo_set: string[]; outcome: AuditOutcome; notes?: string }) => {
    if (!auditTarget) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await recordAuditOutcome(auditTarget.entity_type, auditTarget.entity_id, auditTarget.ownerId ?? undefined, input, user.id);
      showToast("Audit recorded.");
      setAuditTarget(null);
      load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  const handleSendReminder = async (row: AuditQueueRow) => {
    if (!row.ownerId) { showToast("No owner found for this listing."); return; }
    try { await sendReminderNow(row.entity_type, row.entity_id, row.ownerId); showToast("Reminder sent."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleHideOverdue = async () => {
    if (!hideTarget) return;
    try {
      await hideOverdueListing(hideTarget.entity_type, hideTarget.entity_id, hideTarget.ownerId ?? undefined);
      showToast("Listing hidden.");
      setHideTarget(null);
      load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  const columns: Column<AuditQueueRow>[] = [
    {
      key: "entity", label: "Listing",
      render: (r) => (
        <Link href={`${ENTITY_ROUTE[r.entity_type]}/${r.entity_id}`} className="hover:opacity-80">
          <div className="text-white font-medium">{r.entityName}</div>
          <div className="text-white/30 text-xs">{ENTITY_LABEL[r.entity_type]}</div>
        </Link>
      ),
    },
    {
      key: "tier", label: "Status",
      render: (r) => r.reminderTier ? (
        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: `${TIER_COLOR[r.reminderTier]}20`, color: TIER_COLOR[r.reminderTier] }}>
          {TIER_LABEL[r.reminderTier]}
        </span>
      ) : <span className="text-white/30 text-xs">On track</span>,
    },
    { key: "due", label: "Next Due", render: (r) => <span className="text-white/60 text-xs">{new Date(r.next_due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span> },
    { key: "cadence", label: "Cadence", render: (r) => <span className="text-white/40 text-xs">{r.cadence_months}mo</span> },
    { key: "streak", label: "Clean Streak", render: (r) => <span className="text-white/40 text-xs">{r.consecutive_clean_audits}</span> },
    { key: "photos", label: "Photos Refreshed", render: (r) => <span className="text-white/40 text-xs">{r.last_photo_refresh_at ? new Date(r.last_photo_refresh_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Never"}</span> },
    {
      key: "actions", label: "Actions",
      render: (r) => canManage(r.entity_type) ? (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setAuditTarget(r)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>Record Audit</button>
          <button onClick={() => handleSendReminder(r)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Send Reminder</button>
          {r.reminderTier === "overdue" && r.status !== "hidden_overdue" && (
            <button onClick={() => setHideTarget(r)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>Hide Listing</button>
          )}
        </div>
      ) : null,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Audit Queue</h1>
          <p className="text-white/40 text-sm mt-0.5">Periodic re-verification schedule for every approved listing.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      <div className="flex gap-2 mb-4">
        {([["all", "All"], ["overdue", "Overdue"], ["due_soon", "Due Soon"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: filter === key ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)", color: filter === key ? "#F97316" : "rgba(255,255,255,0.5)" }}>
            {label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={filtered} loading={loading} emptyMessage="No audits scheduled." />

      {auditTarget && (
        <RecordAuditModal
          open={!!auditTarget}
          entityName={auditTarget.entityName}
          onSave={handleRecordAudit}
          onCancel={() => setAuditTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!hideTarget}
        title={`Hide ${hideTarget?.entityName}?`}
        description="This listing has been overdue for re-verification past its grace period. Hiding it suspends the listing until it's reverified."
        confirmLabel="Hide Listing"
        danger
        onConfirm={handleHideOverdue}
        onCancel={() => setHideTarget(null)}
      />
    </div>
  );
}
