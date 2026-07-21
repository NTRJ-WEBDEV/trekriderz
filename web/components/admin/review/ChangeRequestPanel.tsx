"use client";
import { useState } from "react";
import { CheckCircle2, Circle, Plus, X } from "lucide-react";
import type { ChangeRequest } from "@/lib/services/ReviewWorkspaceService";

interface Draft {
  issue: string;
  instructions: string;
}

interface ChangeRequestPanelProps {
  requests: ChangeRequest[];
  onSubmit: (items: { issue: string; instructions: string }[]) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  canManage: boolean;
}

// The itemized "Request Changes" composer — PARTNER_PLATFORM.md §9.1 calls
// this the single highest-leverage decision in that whole document: each
// item is independently resolvable rather than one freeform "please fix
// your submission" message.
export default function ChangeRequestPanel({ requests, onSubmit, onResolve, canManage }: ChangeRequestPanelProps) {
  const [drafts, setDrafts] = useState<Draft[]>([{ issue: "", instructions: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status === "resolved");

  const addDraftRow = () => setDrafts((d) => [...d, { issue: "", instructions: "" }]);
  const removeDraftRow = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const updateDraft = (i: number, field: keyof Draft, value: string) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const handleSubmit = async () => {
    const valid = drafts.filter((d) => d.issue.trim() && d.instructions.trim());
    if (valid.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(valid);
      setDrafts([{ issue: "", instructions: "" }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="text-white font-semibold text-sm mb-3">Requested Changes</h3>

      {pending.length === 0 && resolved.length === 0 && (
        <p className="text-white/30 text-sm mb-3">No changes requested yet.</p>
      )}

      {pending.length > 0 && (
        <div className="space-y-2 mb-3">
          {pending.map((r) => (
            <div key={r.id} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Circle size={14} className="mt-0.5 shrink-0" style={{ color: "#F59E0B" }} />
              <div className="flex-1 min-w-0">
                <div className="text-white/85 text-sm font-medium">{r.issue}</div>
                <div className="text-white/50 text-xs mt-0.5">{r.instructions}</div>
              </div>
              {canManage && (
                <button onClick={() => onResolve(r.id)} className="text-xs px-2 py-1 rounded-lg font-medium shrink-0" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>
                  Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {resolved.map((r) => (
            <div key={r.id} className="flex items-start gap-2.5 text-xs opacity-50">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: "#22C55E" }} />
              <span className="text-white/60 line-through">{r.issue}</span>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="pt-3 space-y-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {drafts.map((draft, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={draft.issue}
                onChange={(e) => updateDraft(i, "issue", e.target.value)}
                placeholder="Issue (e.g. 'Blurred ID photo')"
                className="flex-1 rounded-lg px-3 py-2 text-white text-xs outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <input
                value={draft.instructions}
                onChange={(e) => updateDraft(i, "instructions", e.target.value)}
                placeholder="What they need to do"
                className="flex-[2] rounded-lg px-3 py-2 text-white text-xs outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              {drafts.length > 1 && (
                <button onClick={() => removeDraftRow(i)} className="text-white/30 hover:text-white/60 shrink-0"><X size={14} /></button>
              )}
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
