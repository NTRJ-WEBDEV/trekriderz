"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/admin", label: "Overview", icon: "◉", always: true },
  { href: "/admin/users", label: "Users", icon: "👤", always: true },
  { href: "/admin/trips", label: "Trips", icon: "🗺️", always: true },
  { href: "/admin/enquiries", label: "Enquiries", icon: "📩", always: true },
  { href: "/admin/stories", label: "Stories", icon: "📖", always: true },
  { href: "/admin/videos", label: "Videos", icon: "🎬", always: true },
  { href: "/admin/vehicles", label: "Vehicles", icon: "🏍️", superOnly: false },
  { href: "/admin/places", label: "Places Guide", icon: "📍", always: true },
  // "POI Submissions" (user-submitted waterfalls/viewpoints/peaks/etc. pending
  // approval) is deliberately distinct from "Places Guide" above, which is
  // unrelated admin-curated editorial content (places_guide/place-photos).
  { href: "/admin/pois", label: "POI Submissions", icon: "🥾", always: true, badgeKey: "pois" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", superOnly: true },
  { href: "/admin/team", label: "Team", icon: "👥", superOnly: true },
];

export default function AdminShell({ children, profile }: { children: React.ReactNode; profile: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingPoiCount, setPendingPoiCount] = useState(0);
  const isSuperAdmin = profile?.role === "super_admin";

  useEffect(() => {
    const supabase = createClient();
    supabase.from("pois").select("id", { count: "exact", head: true }).eq("status", "pending")
      .then(({ count }) => setPendingPoiCount(count || 0));
  }, []);

  const badgeCounts: Record<string, number> = { pois: pendingPoiCount };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const navItems = NAV.filter(n => n.always || (n.superOnly ? isSuperAdmin : true));

  const Sidebar = () => (
    <div className="flex flex-col h-full" style={{ background: "#080E1F" }}>
      {/* Logo */}
      <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Link href="/" target="_blank" className="block">
          <div className="text-lg font-black tracking-widest">
            <span className="text-white">TREK</span><span style={{ color: "#F97316" }}>RIDERZ</span>
          </div>
          <div className="text-white/30 text-[10px] uppercase tracking-widest mt-0.5">CMS Admin</div>
        </Link>
      </div>

      {/* Role badge */}
      <div className="px-6 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: isSuperAdmin ? "#F97316" : "rgba(255,255,255,0.1)", color: isSuperAdmin ? "#0A0E27" : "#fff" }}>
            {(profile?.name || "A")[0].toUpperCase()}
          </div>
          <div>
            <div className="text-white text-xs font-semibold truncate max-w-[120px]">{profile?.name || profile?.email}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: isSuperAdmin ? "#F97316" : "rgba(255,255,255,0.4)" }}>
              {isSuperAdmin ? "Super Admin" : "Moderator"}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? "rgba(249,115,22,0.15)" : "transparent",
                color: active ? "#F97316" : "rgba(255,255,255,0.55)",
                borderLeft: active ? "3px solid #F97316" : "3px solid transparent",
              }}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badgeKey && badgeCounts[item.badgeKey] > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#F97316", color: "#0A0E27" }}>
                  {badgeCounts[item.badgeKey]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 transition-colors">
          <span>🚪</span><span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0A0E27" }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-56 flex-shrink-0 flex-col border-r" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 flex-shrink-0 flex flex-col border-r" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 text-xl">☰</button>
          <div className="text-sm font-bold text-white">TrekRiderz CMS</div>
        </div>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
