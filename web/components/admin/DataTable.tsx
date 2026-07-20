"use client";
import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

// The one table implementation every admin module renders through —
// sorting/filtering stay page-specific (each page controls its own query),
// but pagination, row selection, loading skeletons, and empty states are
// solved once here instead of once per module.
export default function DataTable<T extends { id: string }>({
  columns, rows, loading, emptyMessage = "Nothing here yet.",
  selectable, selectedIds, onToggleSelect, onToggleSelectAll,
  page = 1, pageSize = 20, total, onPageChange,
}: DataTableProps<T>) {
  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const allSelected = !!selectable && rows.length > 0 && rows.every((r) => selectedIds?.has(r.id));

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-xs uppercase tracking-wide" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="accent-orange-500" />
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 text-left whitespace-nowrap ${col.className || ""}`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {selectable && <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-white/5 animate-pulse" /></td>}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3"><div className="h-4 rounded bg-white/5 animate-pulse" style={{ width: `${40 + ((i * 13) % 40)}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-14 text-white/30">{emptyMessage}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: selectedIds?.has(row.id) ? "rgba(249,115,22,0.06)" : undefined }}
                >
                  {selectable && (
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={!!selectedIds?.has(row.id)} onChange={() => onToggleSelect?.(row.id)} className="accent-orange-500" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className || ""}`}>{col.render ? col.render(row) : (row as any)[col.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total !== undefined && total > pageSize && (
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-white/30 text-xs">Page {page} of {totalPages} · {total} total</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} className="px-3 py-1.5 rounded-lg text-xs text-white/60 disabled:opacity-30" style={{ background: "rgba(255,255,255,0.05)" }}>Prev</button>
            <button disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)} className="px-3 py-1.5 rounded-lg text-xs text-white/60 disabled:opacity-30" style={{ background: "rgba(255,255,255,0.05)" }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
