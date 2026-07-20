interface BulkAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface BulkActionsBarProps {
  count: number;
  actions: BulkAction[];
  onClear: () => void;
}

export default function BulkActionsBar({ count, actions, onClear }: BulkActionsBarProps) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 mb-3" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)" }}>
      <span className="text-sm font-semibold" style={{ color: "#F97316" }}>{count} selected</span>
      <div className="flex gap-2 ml-auto">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: a.danger ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)", color: a.danger ? "#EF4444" : "#fff" }}
          >
            {a.label}
          </button>
        ))}
        <button onClick={onClear} className="px-3 py-1.5 rounded-lg text-xs text-white/40">Clear</button>
      </div>
    </div>
  );
}
