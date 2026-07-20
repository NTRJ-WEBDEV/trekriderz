"use client";
import { useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

// The one confirmation modal every destructive/reason-requiring admin
// action goes through, instead of each page rolling its own dialog.
export default function ConfirmDialog({
  open, title, description, requireReason, reasonLabel = "Reason", confirmLabel = "Confirm", danger, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#0F1420", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-bold text-base mb-1">{title}</h3>
        {description && <p className="text-white/50 text-sm mb-4">{description}</p>}
        {requireReason && (
          <div className="mb-4">
            <label className="text-white/40 text-xs uppercase tracking-wide block mb-1.5">{reasonLabel}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white">Cancel</button>
          <button
            onClick={() => {
              if (requireReason && !reason.trim()) return;
              onConfirm(requireReason ? reason.trim() : undefined);
              setReason("");
            }}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: danger ? "#EF4444" : "#F97316", color: "#fff" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
