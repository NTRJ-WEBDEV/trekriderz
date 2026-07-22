"use client";
import { useEffect, useState } from "react";
import type { DocumentReviewStatus, DocumentStatus } from "@/lib/services/ReviewWorkspaceService";
import { getSignedDocumentUrl } from "@/lib/services/ReviewWorkspaceService";

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

function ReplacementLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { getSignedDocumentUrl(path).then(setUrl); }, [path]);
  if (!url) return <span className="text-white/30 text-xs">Loading replacement…</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: "#8B5CF6" }}>View replacement</a>;
}

// Per-document review state (PARTNER_PLATFORM.md §10.1) — only rendered
// for document slots the entity actually has (slots with a null url are
// skipped by the caller, not shown here as a fake empty row). A partner-
// uploaded replacement stages in `replacement_path` (a raw storage path,
// not a URL — signed URLs expire, so only the path is durable) and is
// shown alongside the original rather than replacing it, so nothing here
// is ever silently overwritten.
export default function DocumentStatusPanel({ slots, statuses, onSetStatus, canManage }: DocumentStatusPanelProps) {
  const present = slots.filter((s) => s.url);
  if (present.length === 0) return null;

  const statusRowFor = (key: string) => statuses.find((s) => s.document_key === key);

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="text-white font-semibold text-sm mb-3">Document Review</h3>
      <div className="space-y-2.5">
        {present.map((slot) => {
          const row = statusRowFor(slot.key);
          const status = row?.status || "pending";
          return (
            <div key={slot.key} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between gap-3">
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
              {row?.replacement_path && (
                <div className="flex items-center gap-2 mt-2 pt-2 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-white/40">Partner uploaded a replacement{row.replacement_uploaded_at ? ` · ${new Date(row.replacement_uploaded_at).toLocaleDateString("en-IN")}` : ""}:</span>
                  <ReplacementLink path={row.replacement_path} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
