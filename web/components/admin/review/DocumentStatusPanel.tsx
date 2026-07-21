"use client";
import type { DocumentReviewStatus, DocumentStatus } from "@/lib/services/ReviewWorkspaceService";

export interface DocumentSlot {
  key: string;
  label: string;
  url: string | null;
}

interface DocumentStatusPanelProps {
  slots: DocumentSlot[];
  statuses: DocumentStatus[];
  onSetStatus: (documentKey: string, status: DocumentReviewStatus) => void;
  canManage: boolean;
}

const STATUS_OPTIONS: DocumentReviewStatus[] = ["pending", "verified", "rejected", "expired"];
const STATUS_COLOR: Record<DocumentReviewStatus, string> = {
  pending: "#9CA3AF", verified: "#22C55E", rejected: "#EF4444", expired: "#F59E0B",
};

// Per-document review state (PARTNER_PLATFORM.md §10.1) — only rendered
// for document slots the entity actually has (slots with a null url are
// skipped by the caller, not shown here as a fake empty row).
export default function DocumentStatusPanel({ slots, statuses, onSetStatus, canManage }: DocumentStatusPanelProps) {
  const present = slots.filter((s) => s.url);
  if (present.length === 0) return null;

  const statusFor = (key: string) => statuses.find((s) => s.document_key === key)?.status || "pending";

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="text-white font-semibold text-sm mb-3">Document Review</h3>
      <div className="space-y-2.5">
        {present.map((slot) => {
          const status = statusFor(slot.key);
          return (
            <div key={slot.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[status] }} />
                <a href={slot.url!} target="_blank" rel="noopener noreferrer" className="text-white/80 text-sm truncate hover:underline">{slot.label}</a>
              </div>
              {canManage ? (
                <select
                  value={status}
                  onChange={(e) => onSetStatus(slot.key, e.target.value as DocumentReviewStatus)}
                  className="text-xs rounded-lg px-2 py-1.5 outline-none capitalize shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: STATUS_COLOR[status] }}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-[#0F1420] text-white capitalize">{s}</option>)}
                </select>
              ) : (
                <span className="text-xs capitalize shrink-0" style={{ color: STATUS_COLOR[status] }}>{status}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
