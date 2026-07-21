import Link from "next/link";
import {
  Compass, UserCheck, Home, Image, Film, Users2, Siren, Flag, Bell, Trophy, Users, Globe,
} from "lucide-react";
import { glassCard, HOVER_LIFT } from "@/lib/adminTheme";

export interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission: string | null;
}

export const DASHBOARD_QUICK_ACTIONS: QuickAction[] = [
  { label: "Create Trip", href: "/admin/expeditions", icon: <Compass size={20} />, permission: "expeditions.manage" },
  { label: "Approve Guide", href: "/admin/guides", icon: <UserCheck size={20} />, permission: "guides.approve" },
  { label: "Approve Homestay", href: "/admin/homestays", icon: <Home size={20} />, permission: "homestays.approve" },
  { label: "Moderate Posts", href: "/admin/moderation", icon: <Image size={20} />, permission: "posts.delete" },
  { label: "Moderate Reels", href: "/admin/moderation", icon: <Film size={20} />, permission: "reels.moderate" },
  { label: "Community", href: "/admin/communities", icon: <Users2 size={20} />, permission: "communities.manage" },
  { label: "SOS Center", href: "/admin/sos", icon: <Siren size={20} />, permission: "sos.manage" },
  { label: "Reports", href: "/admin/reports", icon: <Flag size={20} />, permission: "reports.resolve" },
  { label: "Notifications", href: "/admin/notifications", icon: <Bell size={20} />, permission: null },
  { label: "Rewards", href: "/admin/community-champions", icon: <Trophy size={20} />, permission: "reward_campaigns.view" },
  { label: "Users", href: "/admin/users", icon: <Users size={20} />, permission: "users.view" },
  { label: "Website CMS", href: "/admin/stories", icon: <Globe size={20} />, permission: "cms.edit" },
];

export default function QuickActionGrid({ hasPermission }: { hasPermission: (key: string) => boolean }) {
  const actions = DASHBOARD_QUICK_ACTIONS.filter((a) => a.permission === null || hasPermission(a.permission));
  if (actions.length === 0) return <p className="text-white/30 text-sm text-center py-6">No quick actions available for your role.</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className={`flex flex-col items-center justify-center gap-2 px-3 py-5 rounded-2xl text-center text-white/70 hover:text-white ${HOVER_LIFT}`}
          style={glassCard}
        >
          <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(140,198,63,0.12)", color: "#8CC63F" }}>
            {a.icon}
          </span>
          <span className="text-xs font-medium leading-tight">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}
