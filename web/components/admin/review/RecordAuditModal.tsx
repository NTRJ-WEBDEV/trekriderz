"use client";
import { useState } from "react";
import type { AuditType, AuditOutcome, AuditChecklist } from "@/lib/services/AuditWorkspaceService";

interface RecordAuditModalProps {
  open: boolean;
  entityName: string;
  onSave: (input: { audit_type: AuditType; checklist: AuditChecklist; photo_set: string[]; outcome: AuditOutcome; notes?: string }) => Promise<void>;
  onCancel: () => void;
}

const AUDIT_TYPES: { value: AuditType; label: string }[] = [
  { value: "video", label: "Video Walkthrough" },
  { value: "physical", label: "Physical Visit" },
  { value: "document_only", label: "Document Refresh" },
  { value: "component_refresh", label: "Component Refresh" },
];

const CHECKLIST_ITEMS: { key: keyof AuditChecklist; label: string }[] = [
  { key: "photos_refreshed", label: "Fresh photos reviewed" },
  { key: "facility_verified", label: "Claimed amenities/facilities still present" },
  { key: "price_verified", label: "Live pricing matches what's actually charged" },
  { key: "nearby_attractions_verified", label: "Nearby attraction claims accurate" },
  { key: "location_verified", label: "Location/pin matches satellite imagery" },
];

// PARTNER_PLATFORM.md §8.4's checklist, as a form — structured so audits
// are comparable audit-over-audit, not freeform notes.
export default function RecordAuditModal({ open, entityName, onSave, onCancel }: RecordAuditModalProps) {
  const [auditType, setAuditType] = useState<AuditType>("video");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [conditionReport, setConditionReport] = useState("");
  const [photoUrls, setPhotoUrls] = useState("");
  const [outcome, setOutcome] = useState<AuditOutcome>("pass");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggle = (key: string) => setChecklist((c) => ({ ...c, [key]: !c[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        audit_type: auditType,
        checklist: { ...checklist, condition_report: conditionReport || undefined },
        photo_set: photoUrls.split("\n").map((s) => s.trim()).filter(Boolean),
        outcome,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ background: "#0F1420", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-bold text-base mb-1">Record Audit</h3>
        <p className="text-white/40 text-xs mb-4">{entityName}</p>

        <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Audit Type</label>
        <select value={auditType} onChange={(e) => setAuditType(e.target.value as AuditType)}
          className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none mb-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {AUDIT_TYPES.map((t) => <option key={t.value} value={t.value} className="bg-[#0F1420]">{t.label}</option>)}
        </select>

        <label className="text-white/50 text-xs uppercase tracking-wider block mb-2">Checklist</label>
        <div className="space-y-2 mb-4">
          {CHECKLIST_ITEMS.map((item) => (
            <label key={item.key} className="flex items-center gap-2.5 text-sm text-white/70 cursor-pointer">
              <input type="checkbox" checked={!!checklist[item.key]} onChange={() => toggle(item.key)} className="accent-orange-500 w-4 h-4" />
              {item.label}
            </label>
          ))}
        </div>

        <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Condition Report</label>
        <textarea value={conditionReport} onChange={(e) => setConditionReport(e.target.value)} rows={3}
          placeholder="Notes on physical/video condition observed"
          className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none resize-none mb-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />

        <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Reference Photo URLs (optional, one per line)</label>
        <textarea value={photoUrls} onChange={(e) => setPhotoUrls(e.target.value)} rows={2}
          className="w-full rounded-xl px-3 py-2 text-white text-xs font-mono outline-none resize-none mb-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />

        <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Outcome</label>
        <div className="flex gap-2 mb-4">
          {(["pass", "minor_issues", "fail"] as AuditOutcome[]).map((o) => (
            <button key={o} onClick={() => setOutcome(o)}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold capitalize"
              style={{
                background: outcome === o ? (o === "pass" ? "rgba(34,197,94,0.15)" : o === "fail" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)") : "rgba(255,255,255,0.05)",
                color: outcome === o ? (o === "pass" ? "#22C55E" : o === "fail" ? "#EF4444" : "#F59E0B") : "rgba(255,255,255,0.5)",
              }}>
              {o.replace("_", " ")}
            </button>
          ))}
        </div>
        {outcome === "fail" && (
          <p className="text-xs mb-3" style={{ color: "#EF4444" }}>Recording "Fail" immediately suspends this listing until reverified.</p>
        )}

        <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Notes {outcome !== "pass" && "(shown to partner if suspended)"}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none resize-none mb-5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/60" style={{ background: "rgba(255,255,255,0.05)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: "#F97316", color: "#0A0E27" }}>
            {saving ? "Saving…" : "Save Audit"}
          </button>
        </div>
      </div>
    </div>
  );
}
