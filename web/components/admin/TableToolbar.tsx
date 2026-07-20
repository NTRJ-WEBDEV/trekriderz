"use client";
import { ReactNode } from "react";

interface TableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode; // filter dropdowns, status tabs, etc.
}

export default function TableToolbar({ search, onSearchChange, placeholder = "Search…", children }: TableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-[200px] rounded-lg px-3 py-2 text-sm text-white outline-none"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
      />
      {children}
    </div>
  );
}
