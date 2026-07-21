import { ReactNode } from "react";

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// The one place "Not provided" gets decided — every review page field
// goes through this instead of each page inventing its own empty-check,
// so a missing value never silently renders as blank.
export default function DetailField({ label, value }: { label: string; value: ReactNode | null | undefined }) {
  return (
    <div>
      <div className="text-white/35 text-xs uppercase tracking-wide mb-1">{label}</div>
      <div className="text-white/85 text-sm">
        {isEmpty(value) ? <span className="text-white/25 italic">Not provided</span> : value}
      </div>
    </div>
  );
}
