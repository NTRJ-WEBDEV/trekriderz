import StatusBadge from "@/components/admin/StatusBadge";

interface ReviewActionsPanelProps {
  status: string;
  isSuspended: boolean;
  isFeatured: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canFeature: boolean;
  submittedAt: string | null;
  onApprove: () => void;
  onReject: () => void;
  onToggleSuspend: () => void;
  onToggleFeature: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ActionButton({
  children, onClick, variant = "default",
}: { children: React.ReactNode; onClick: () => void; variant?: "default" | "primary" | "danger" }) {
  const styles = {
    default: { background: "rgba(255,255,255,0.06)", color: "#fff" },
    primary: { background: "#F97316", color: "#0A0E27" },
    danger: { background: "rgba(239,68,68,0.15)", color: "#EF4444" },
  }[variant];
  return (
    <button onClick={onClick} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90" style={styles}>
      {children}
    </button>
  );
}

export default function ReviewActionsPanel({
  status, isSuspended, isFeatured, canApprove, canEdit, canDelete, canFeature, submittedAt,
  onApprove, onReject, onToggleSuspend, onToggleFeature, onEdit, onDelete,
}: ReviewActionsPanelProps) {
  const isApproved = status === "approved";

  return (
    <div className="lg:sticky lg:top-6 rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/40 text-xs uppercase tracking-wide">Status</span>
        <StatusBadge status={status} />
      </div>
      {submittedAt && (
        <div className="text-white/30 text-xs mb-3">
          Submitted {new Date(submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      )}

      {canApprove && !isApproved && (
        <>
          <ActionButton variant="primary" onClick={onApprove}>Approve</ActionButton>
          <ActionButton variant="danger" onClick={onReject}>Reject</ActionButton>
        </>
      )}

      {canApprove && (
        <ActionButton onClick={onToggleSuspend}>{isSuspended ? "Restore" : "Suspend"}</ActionButton>
      )}

      {canFeature && (
        <ActionButton onClick={onToggleFeature}>{isFeatured ? "Unfeature" : "Feature"}</ActionButton>
      )}

      {canEdit && <ActionButton onClick={onEdit}>Edit</ActionButton>}

      {canDelete && <ActionButton variant="danger" onClick={onDelete}>Delete</ActionButton>}
    </div>
  );
}
