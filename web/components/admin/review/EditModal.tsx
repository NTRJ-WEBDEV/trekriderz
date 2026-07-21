"use client";
import { useState } from "react";

export interface EditableField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  value: string | number | null;
}

interface EditModalProps {
  open: boolean;
  title: string;
  fields: EditableField[];
  onSave: (values: Record<string, string | number>) => void;
  onCancel: () => void;
}

// Covers correction of a curated set of commonly-mistyped fields per
// entity (name/location/price/description) rather than a full per-column
// form — full listing content is owner-authored via the mobile app; the
// admin surface here is for fixing an obvious error before/after review,
// not recreating the listing.
export default function EditModal({ open, title, fields, onSave, onCancel }: EditModalProps) {
  const [values, setValues] = useState<Record<string, string | number>>({});

  if (!open) return null;

  const get = (f: EditableField) => (values[f.key] !== undefined ? values[f.key] : f.value ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: "#0F1420", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-base mb-4">{title}</h3>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={get(f)}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none resize-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={get(f)}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/60"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(values)}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#F97316", color: "#0A0E27" }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
