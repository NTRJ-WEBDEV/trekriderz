"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { search as globalSearch, SearchResult } from "@/lib/services/SearchService";
import { AdminPermissionsProvider } from "@/lib/adminPermissions";

// `permission: null` means visible to any signed-in staff member — no
// finer-grained key exists yet for these low-risk CMS screens. Settings and
// Team are the two that used to be gated by a hardcoded `superOnly`/
// `isSuperAdmin` check; they now go through the same has_permission() RBAC
// system as every other module instead of a special-cased boolean.
const NAV = [
  { href: "/admin", label: "Dashboard", icon: "◉", permission: null },
  { href: "/admin/guides", label: "Guides", icon: "🧭", permission: "guides.approve", badgeKey: "guides" },
  { href: "/admin/homestays", label: "Homestays", icon: "🏡", permission: "homestays.approve", badgeKey: "homestays" },
  { href: "/admin/rentals", label: "Rentals", icon: "🚙", permission: "rentals.approve", badgeKey: "rentals" },
  { href: "/admin/expeditions", label: "Expeditions", icon: "🏔️", permission: "expeditions.manage" },
  { href: "/admin/communities", label: "Communities", icon: "🫂", permission: "communities.manage" },
  { href: "/admin/trips", label: "Trips", icon: "🗺️", permission: "trips.view" },
  { href: "/admin/moderation", label: "Content", icon: "🎞️", permission: "reels.moderate" },
  { href: "/admin/reports", label: "Reports", icon: "🚩", permission: "reports.resolve", badgeKey: "reports" },
  { href: "/admin/sos", label: "SOS Center", icon: "🆘", permission: "sos.manage" },
  { href: "/admin/users", label: "Users", icon: "👤", permission: "users.view" },
  { href: "/admin/community-champions", label: "Community Champions", icon: "🏆", permission: "reward_campaigns.view" },
  { href: "/admin/featured", label: "Featured", icon: "⭐", permission: "featured.manage" },
  { href: "/admin/analytics", label: "Analytics", icon: "📊", permission: "analytics.view" },
  { href: "/admin/notifications", label: "Notifications", icon: "🔔", permission: null },
  { href: "/admin/enquiries", label: "Enquiries", icon: "📩", permission: null },
  { href: "/admin/stories", label: "Stories", icon: "📖", permission: "cms.edit" },
  { href: "/admin/videos", label: "Videos", icon: "🎬", permission: "cms.edit" },
  { href: "/admin/vehicles", label: "Vehicles (CMS)", icon: "🏍️", permission: "rentals.edit" },
  { href: "/admin/places", label: "Places Guide", icon: "📍", permission: "cms.edit" },
  // "POI Submissions" (user-submitted waterfalls/viewpoints/peaks/etc. pending
  // approval) is deliberately distinct from "Places Guide" above, which is
  // unrelated admin-curated editorial content (places_guide/place-photos).
  { href: "/admin/pois", label: "POI Submissions", icon: "🥾", permission: "cms.edit", badgeKey: "pois" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", permission: "rbac.manage" },
  { href: "/admin/team", label: "Team", icon: "👥", permission: "rbac.manage" },
];

// Pending-count sources for sidebar badges + the notification bell. Direct
// counts + a realtime resubscribe on change, not a fan-out notification row
// per staff member — "N admins should all see this until someone handles
// it" is a live query over status='pending', not personal-inbox semantics,
// so it reuses the tables these modules already manage instead of writing
// into `notifications` (which is shaped for one recipient per row).
const PENDING_SOURCES: { key: string; table: string; filter: [string, string] }[] = [
  { key: "guides", table: "guides", filter: ["status", "pending"] },
  { key: "homestays", table: "properties", filter: ["status", "pending"] },
  { key: "rentals", table: "rental_vehicles", filter: ["status", "pending"] },
  { key: "pois", table: "pois", filter: ["status", "pending"] },
];

export default function AdminShell({ children, profile, permissions = [] }: { children: React.ReactNode; profile: any; permissions?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [reportsCount, setReportsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPermission = (key: string | null) => key === null || permissions.includes(key);
  const isSuperAdmin = profile?.staff_role?.key === "super_admin";

  const loadCounts = async () => {
    const supabase = createClient();
    const results = await Promise.all(
      PENDING_SOURCES.map((s) => supabase.from(s.table).select("id", { count: "exact", head: true }).eq(s.filter[0], s.filter[1]))
    );
    const counts: Record<string, number> = {};
    PENDING_SOURCES.forEach((s, i) => { counts[s.key] = results[i].count || 0; });
    setBadgeCounts(counts);

    const [{ count: postReportsCount }, { count: contentReportsCount }] = await Promise.all([
      supabase.from("post_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setReportsCount((postReportsCount || 0) + (contentReportsCount || 0));
  };

  useEffect(() => {
    loadCounts();
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-badges:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "guides" }, loadCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, loadCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_vehicles" }, loadCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "pois" }, loadCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reports" }, loadCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "content_reports" }, loadCounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const allBadgeCounts: Record<string, number> = { ...badgeCounts, reports: reportsCount };
  const totalPending = Object.values(allBadgeCounts).reduce((a, b) => a + b, 0);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      const results = await globalSearch(value);
      setSearchResults(results);
      setSearchOpen(true);
    }, 250);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const navItems = NAV.filter(n => hasPermission(n.permission));

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
              {profile?.staff_role?.name || "Staff"}
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
              {item.badgeKey && allBadgeCounts[item.badgeKey] > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#F97316", color: "#0A0E27" }}>
                  {allBadgeCounts[item.badgeKey]}
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
        {/* Topbar — global search + notification bell, all screen sizes */}
        <div className="flex items-center gap-3 px-4 py-3 border-b relative" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/60 text-xl">☰</button>
          <div className="lg:hidden text-sm font-bold text-white">TrekRiderz CMS</div>

          <div className="relative flex-1 max-w-md">
            <input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Search users, trips, guides, homestays…"
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 max-h-96 overflow-y-auto"
                style={{ background: "#0F1420", border: "1px solid rgba(255,255,255,0.1)" }}>
                {searchResults.map((r) => (
                  <Link key={`${r.entityType}-${r.id}`} href={r.route} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 block"
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                    <div>
                      <div className="text-white text-sm">{r.title}</div>
                      {r.subtitle && <div className="text-white/30 text-xs">{r.subtitle}</div>}
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-white/30">{r.entityType}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="relative ml-auto">
            <button onClick={() => setNotifOpen((v) => !v)} className="relative text-white/60 hover:text-white text-lg px-2">
              🔔
              {totalPending > 0 && (
                <span className="absolute -top-1 -right-1 text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1"
                  style={{ background: "#EF4444", color: "#fff" }}>
                  {totalPending > 99 ? "99+" : totalPending}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute top-full right-0 mt-2 w-72 rounded-xl overflow-hidden z-50"
                style={{ background: "#0F1420", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="px-4 py-3 text-white text-xs font-bold uppercase tracking-wide" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Pending Attention</div>
                {[
                  { label: "Guides awaiting approval", count: badgeCounts.guides || 0, href: "/admin/guides" },
                  { label: "Homestays awaiting approval", count: badgeCounts.homestays || 0, href: "/admin/homestays" },
                  { label: "Rentals awaiting approval", count: badgeCounts.rentals || 0, href: "/admin/rentals" },
                  { label: "POI submissions", count: badgeCounts.pois || 0, href: "/admin/pois" },
                  { label: "Open reports", count: reportsCount, href: "/admin/reports" },
                ].filter((n) => n.count > 0).map((n) => (
                  <Link key={n.label} href={n.href} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 text-white/70"
                    onClick={() => setNotifOpen(false)}>
                    {n.label}
                    <span className="font-bold" style={{ color: "#F97316" }}>{n.count}</span>
                  </Link>
                ))}
                {totalPending === 0 && <div className="px-4 py-6 text-center text-white/30 text-sm">All caught up.</div>}
                <Link href="/admin/notifications" className="block px-4 py-2.5 text-center text-xs" style={{ color: "#F97316", borderTop: "1px solid rgba(255,255,255,0.06)" }} onClick={() => setNotifOpen(false)}>
                  View all
                </Link>
              </div>
            )}
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          <AdminPermissionsProvider permissions={permissions}>{children}</AdminPermissionsProvider>
        </main>
      </div>
    </div>
  );
}
