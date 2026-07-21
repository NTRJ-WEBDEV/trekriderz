"use client";
import { useState } from "react";
import type { InternalNote } from "@/lib/services/ReviewWorkspaceService";

interface InternalNotesPanelProps {
  notes: InternalNote[];
  onAddNote: (note: string) => Promise<void>;
  canManage: boolean;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Staff-only — never surfaced to the partner. Distinct from
// ChangeRequestPanel, which IS partner-facing (PARTNER_PLATFORM.md §10.1).
export default function InternalNotesPanel({ notes, onAddNote, canManage }: InternalNotesPanelProps) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onAddNote(draft.trim());
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Internal Notes</h3>
        <span className="text-[10px] uppercase tracking-wide text-white/30">Staff only — never shown to partner</span>
      </div>

      {notes.length === 0 ? (
        <p className="text-white/30 text-sm mb-3">No internal notes yet.</p>
      ) : (
        <div className="space-y-2.5 mb-3 max-h-56 overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="text-sm">
              <div className="text-white/70">{n.note}</div>
              <div className="text-white/25 text-xs mt-0.5">{n.users?.full_name || "Staff"} · {timeAgo(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add a note for other reviewers…"
            className="flex-1 rounded-lg px-3 py-2 text-white text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={handleAdd}
            disabled={saving}
            className="text-xs px-3 py-2 rounded-lg font-semibold disabled:opacity-50"
            style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8" }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
