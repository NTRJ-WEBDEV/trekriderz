import Link from "next/link";

export interface QuickAction {
  label: string;
  href: string;
  icon: string;
  permission: string | null;
}

export const DASHBOARD_QUICK_ACTIONS: QuickAction[] = [
  { label: "Approve Guides", href: "/admin/guides", icon: "🧭", permission: "guides.approve" },
  { label: "Approve Homestays", href: "/admin/homestays", icon: "🏡", permission: "homestays.approve" },
  { label: "Approve Vehicles", href: "/admin/rentals", icon: "🚙", permission: "rentals.approve" },
  { label: "Moderate Content", href: "/admin/moderation", icon: "🖼️", permission: "posts.delete" },
  { label: "Review Reports", href: "/admin/reports", icon: "🚩", permission: "reports.resolve" },
  { label: "View Enquiries", href: "/admin/enquiries", icon: "📩", permission: "trips.view" },
  { label: "Manage Trips", href: "/admin/trips", icon: "🗺️", permission: "trips.manage" },
  { label: "Open SOS Center", href: "/admin/sos", icon: "🆘", permission: "sos.manage" },
  { label: "Manage Featured Content", href: "/admin/featured", icon: "⭐", permission: "cms.publish" },
  { label: "Open Community Champions", href: "/admin/community-champions", icon: "🏆", permission: "reward_campaigns.view" },
];

export default function QuickActionGrid({ hasPermission }: { hasPermission: (key: string) => boolean }) {
  const actions = DASHBOARD_QUICK_ACTIONS.filter((a) => a.permission === null || hasPermission(a.permission));
  if (actions.length === 0) return <p className="text-white/30 text-sm text-center py-6">No quick actions available for your role.</p>;
  return (
    <div className="space-y-2">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white transition-colors"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-base">{a.icon}</span>
          <span>{a.label}</span>
          <span className="ml-auto text-white/30">→</span>
        </Link>
      ))}
    </div>
  );
}
