"use client";
import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Plus, RotateCcw, ShieldCheck, X } from "lucide-react";
import type { ChangeRequest, ChangeRequestPriority } from "@/lib/services/ReviewWorkspaceService";

interface Draft {
  issue: string;
  instructions: string;
  priority: ChangeRequestPriority;
  field_key: string;
}

interface ChangeRequestPanelProps {
  requests: ChangeRequest[];
  onSubmit: (items: { issue: string; instructions: string; priority: ChangeRequestPriority; field_key: string | null }[]) => Promise<void>;
  onMarkResolved: (id: string) => Promise<void>;
  onMarkVerified: (id: string) => Promise<void>;
  onReopen: (id: string, note: string) => Promise<void>;
  canManage: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested", partner_working: "Partner Working", ready_for_review: "Ready For Review",
  resolved: "Resolved", verified: "Verified",
};
const STATUS_COLOR: Record<string, string> = {
  requested: "#F59E0B", partner_working: "#3897F0", ready_for_review: "#8B5CF6",
  resolved: "#22C55E", verified: "#22C55E",
};
const PRIORITY_COLOR: Record<ChangeRequestPriority, string> = { low: "#9CA3AF", medium: "#F59E0B", high: "#EF4444" };

// The itemized "Request Changes" composer — PARTNER_PLATFORM.md §9.1 calls
// this the single highest-leverage decision in that whole document: each
// item is independently resolvable rather than one freeform "please fix
// your submission" message. Status flow (docs/architecture PARTNER_PLATFORM
// build-phase revision): requested → partner_working → ready_for_review →
// resolved → verified, full history kept in status_history, never overwritten.
export default function ChangeRequestPanel({ requests, onSubmit, onMarkResolved, onMarkVerified, onReopen, canManage }: ChangeRequestPanelProps) {
  const [drafts, setDrafts] = useState<Draft[]>([{ issue: "", instructions: "", priority: "medium", field_key: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<string | null>(null);
  const [reopenNote, setReopenNote] = useState("");

  const open = requests.filter((r) => !["resolved", "verified"].includes(r.status));
  const closed = requests.filter((r) => ["resolved", "verified"].includes(r.status));

  const addDraftRow = () => setDrafts((d) => [...d, { issue: "", instructions: "", priority: "medium", field_key: "" }]);
  const removeDraftRow = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const updateDraft = (i: number, field: keyof Draft, value: string) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const handleSubmit = async () => {
    const valid = drafts.filter((d) => d.issue.trim() && d.instructions.trim());
    if (valid.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(valid.map((d) => ({ ...d, field_key: d.field_key.trim() || null })));
      setDrafts([{ issue: "", instructions: "", priority: "medium", field_key: "" }]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenTarget || !reopenNote.trim()) return;
    await onReopen(reopenTarget, reopenNote.trim());
    setReopenTarget(null);
    setReopenNote("");
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="text-white font-semibold text-sm mb-3">Requested Changes</h3>

      {open.length === 0 && closed.length === 0 && (
        <p className="text-white/30 text-sm mb-3">No changes requested yet.</p>
      )}

      {open.length > 0 && (
        <div className="space-y-2 mb-3">
          {open.map((r) => (
            <div key={r.id} className="rounded-xl p-3" style={{ background: `${STATUS_COLOR[r.status]}14`, border: `1px solid ${STATUS_COLOR[r.status]}30` }}>
              <div className="flex items-start gap-2.5">
                {r.status === "ready_for_review" ? <Loader2 size={14} className="mt-0.5 shrink-0" style={{ color: STATUS_COLOR[r.status] }} /> : <Circle size={14} className="mt-0.5 shrink-0" style={{ color: STATUS_COLOR[r.status] }} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/85 text-sm font-medium">{r.issue}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: `${PRIORITY_COLOR[r.priority]}20`, color: PRIORITY_COLOR[r.priority] }}>{r.priority}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_COLOR[r.status]}20`, color: STATUS_COLOR[r.status] }}>{STATUS_LABEL[r.status]}</span>
                  </div>
                  <div className="text-white/50 text-xs mt-0.5">{r.instructions}</div>
                  {r.field_key && <div className="text-white/25 text-[10px] mt-1 font-mono">field: {r.field_key}</div>}
                  {r.partner_comment && (
                    <div className="text-white/60 text-xs mt-1.5 italic">"{r.partner_comment}"</div>
                  )}
                </div>
                {canManage && r.status === "ready_for_review" && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => onMarkResolved(r.id)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>Resolve</button>
                    <button onClick={() => setReopenTarget(r.id)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>Send Back</button>
                  </div>
                )}
              </div>
              {reopenTarget === r.id && (
                <div className="flex gap-2 mt-2.5 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <input value={reopenNote} onChange={(e) => setReopenNote(e.target.value)} placeholder="Why is this still not resolved?"
                    className="flex-1 rounded-lg px-3 py-1.5 text-white text-xs outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  <button onClick={handleReopen} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>Send</button>
                  <button onClick={() => setReopenTarget(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {closed.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 text-xs opacity-60">
              {r.status === "verified" ? <ShieldCheck size={13} className="shrink-0" style={{ color: "#22C55E" }} /> : <CheckCircle2 size={13} className="shrink-0" style={{ color: "#22C55E" }} />}
              <span className="text-white/60 line-through flex-1">{r.issue}</span>
              {r.status === "resolved" && canManage && (
                <button onClick={() => onMarkVerified(r.id)} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium no-underline" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>
                  <RotateCcw size={10} className="inline mr-1" />Mark Verified
                </button>
              )}
              {r.status === "verified" && <span className="text-[10px] uppercase tracking-wide">Verified</span>}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="pt-3 space-y-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {drafts.map((draft, i) => (
            <div key={i} className="rounded-lg p-2.5 space-y-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex gap-2">
                <input
                  value={draft.issue}
                  onChange={(e) => updateDraft(i, "issue", e.target.value)}
                  placeholder="Issue (e.g. 'Blurred ID photo')"
                  className="flex-1 rounded-lg px-3 py-2 text-white text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <select
                  value={draft.priority}
                  onChange={(e) => updateDraft(i, "priority", e.target.value)}
                  className="rounded-lg px-2 py-2 text-xs outline-none capitalize shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: PRIORITY_COLOR[draft.priority] }}
                >
                  {(["low", "medium", "high"] as ChangeRequestPriority[]).map((p) => <option key={p} value={p} className="bg-[#0F1420] text-white capitalize">{p}</option>)}
                </select>
                {drafts.length > 1 && (
                  <button onClick={() => removeDraftRow(i)} className="text-white/30 hover:text-white/60 shrink-0"><X size={14} /></button>
                )}
              </div>
              <input
                value={draft.instructions}
                onChange={(e) => updateDraft(i, "instructions", e.target.value)}
                placeholder="What they need to do"
                className="w-full rounded-lg px-3 py-2 text-white text-xs outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <input
                value={draft.field_key}
                onChange={(e) => updateDraft(i, "field_key", e.target.value)}
                placeholder="Linked field (optional, e.g. 'identity_doc_front', 'location', 'rate_per_day') — leave blank for a general note"
                className="w-full rounded-lg px-3 py-2 text-white/70 text-xs outline-none font-mono"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)" }}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={addDraftRow} className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80">
              <Plus size={12} /> Add item
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}
            >
              {submitting ? "Sending…" : "Request Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
