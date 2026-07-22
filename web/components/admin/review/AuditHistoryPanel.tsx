"use client";
import { useState } from "react";
import { CalendarClock, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import RecordAuditModal from "./RecordAuditModal";
import type { AuditRecord, AuditSchedule, AuditType, AuditChecklist, AuditOutcome } from "@/lib/services/AuditWorkspaceService";

interface AuditHistoryPanelProps {
  schedule: AuditSchedule | null;
  records: AuditRecord[];
  entityName: string;
  canManage: boolean;
  onRecordAudit: (input: { audit_type: AuditType; checklist: AuditChecklist; photo_set: string[]; outcome: AuditOutcome; notes?: string }) => Promise<void>;
}

const OUTCOME_ICON: Record<string, any> = { pass: ShieldCheck, minor_issues: ShieldAlert, fail: ShieldX };
const OUTCOME_COLOR: Record<string, string> = { pass: "#22C55E", minor_issues: "#F59E0B", fail: "#EF4444" };

// Compact per-listing view of the same audit system the /admin/audits
// queue manages globally — a reviewer looking at one listing shouldn't
// have to leave the review page to see or record its audit history.
export default function AuditHistoryPanel({ schedule, records, entityName, canManage, onRecordAudit }: AuditHistoryPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = async (input: any) => {
    await onRecordAudit(input);
    setModalOpen(false);
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Audit &amp; Reverification</h3>
        {canManage && (
          <button onClick={() => setModalOpen(true)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>
            Record Audit
          </button>
        )}
      </div>

      {schedule ? (
        <div className="flex items-center gap-2 text-xs text-white/50 mb-3">
          <CalendarClock size={14} />
          Next due {new Date(schedule.next_due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          <span className="text-white/25">· {schedule.cadence_months}mo cadence · {schedule.consecutive_clean_audits} clean streak</span>
        </div>
      ) : (
        <p className="text-white/30 text-xs mb-3">No audit schedule yet — one is created automatically on approval.</p>
      )}

      {records.length === 0 ? (
        <p className="text-white/30 text-sm">No audits recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const Icon = OUTCOME_ICON[r.outcome || "pass"];
            const color = OUTCOME_COLOR[r.outcome || "pass"];
            return (
              <div key={r.id} className="flex items-start gap-2.5 text-sm">
                <Icon size={15} className="mt-0.5 shrink-0" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 capitalize">
                    {r.audit_type.replace("_", " ")} — <span style={{ color }}>{r.outcome?.replace("_", " ")}</span>
                  </div>
                  {r.notes && <div className="text-white/40 text-xs mt-0.5">{r.notes}</div>}
                </div>
                <span className="text-white/25 text-xs shrink-0">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
              </div>
            );
          })}
        </div>
      )}

      <RecordAuditModal open={modalOpen} entityName={entityName} onSave={handleSave} onCancel={() => setModalOpen(false)} />
    </div>
  );
}
