import { getAdminSession } from "@/lib/supabase-server";
import {
  getOperationsInbox, getTodayKpis, getRecentActivity, getUpcomingOperations,
  getRecentEnquiries, getCommunityHealth, getSystemHealth, getChampionsPreview,
} from "@/lib/services/DashboardService";
import DashboardSection from "@/components/admin/dashboard/DashboardSection";
import AttentionCard from "@/components/admin/dashboard/AttentionCard";
import KPIStatCard from "@/components/admin/dashboard/KPIStatCard";
import ActivityTimeline from "@/components/admin/dashboard/ActivityTimeline";
import ChampionsLeaderboard from "@/components/admin/dashboard/ChampionsLeaderboard";
import UpcomingTripOpsCard from "@/components/admin/dashboard/UpcomingTripOpsCard";
import SystemHealthCard from "@/components/admin/dashboard/SystemHealthCard";
import QuickActionGrid from "@/components/admin/dashboard/QuickActionGrid";
import DashboardDateFilter from "@/components/admin/dashboard/DashboardDateFilter";
import StatusBadge from "@/components/admin/StatusBadge";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) return null; // middleware.ts already redirects unauthenticated/non-staff requests

  const { profile, permissions } = session;
  const hasPermission = (key: string) => permissions.includes(key);
  const horizonDays = Number((await searchParams).horizon) || 7;

  const [inbox, kpis, activity, upcoming, enquiries, communityHealth, systemHealth, champions] = await Promise.all([
    getOperationsInbox(hasPermission),
    getTodayKpis(hasPermission),
    getRecentActivity(hasPermission),
    getUpcomingOperations(hasPermission, horizonDays),
    getRecentEnquiries(hasPermission),
    getCommunityHealth(hasPermission),
    getSystemHealth(),
    getChampionsPreview(hasPermission),
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-white text-2xl font-bold">TrekRiderz Mission Control</h1>
          <p className="text-white/40 text-sm mt-1">
            {greeting()}, {profile?.name || profile?.email}. Here's what needs attention across TrekRiderz today.
          </p>
        </div>
        <DashboardDateFilter />
      </div>

      {/* A. Operations Inbox */}
      {inbox.length > 0 && (
        <DashboardSection title="Operations Inbox" subtitle="What needs action right now.">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {inbox.map((card) => <AttentionCard key={card.key} card={card} />)}
          </div>
        </DashboardSection>
      )}

      {/* B. Today's KPIs */}
      {kpis.length > 0 && (
        <DashboardSection title="Today's KPIs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map((kpi) => <KPIStatCard key={kpi.key} kpi={kpi} />)}
          </div>
        </DashboardSection>
      )}

      {/* C. Community Champions */}
      {champions.campaign && (
        <DashboardSection
          title="Community Champions"
          subtitle={champions.campaign.name}
          viewAllHref="/admin/community-champions"
        >
          <ChampionsLeaderboard rows={champions.candidates} />
        </DashboardSection>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* D. Recent Activity Timeline */}
        {hasPermission("activity_log.view") && (
          <div className="rounded-2xl p-6 mb-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Recent Activity</h2>
              <span className="text-[11px] text-white/30">last {activity.length} actions</span>
            </div>
            <ActivityTimeline rows={activity} />
          </div>
        )}

        {/* Quick Actions (H) shown alongside activity, matching the original two-column layout */}
        <div className="rounded-2xl p-6 mb-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
          <QuickActionGrid hasPermission={hasPermission} />
        </div>
      </div>

      {/* E. Upcoming Operations Calendar */}
      {upcoming.length > 0 && (
        <DashboardSection title="Upcoming Operations" subtitle={`Departing in the next ${horizonDays} days.`} viewAllHref="/admin/expeditions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((e) => <UpcomingTripOpsCard key={e.id} expedition={e} />)}
          </div>
        </DashboardSection>
      )}

      {/* Recent Enquiries */}
      {enquiries.length > 0 && (
        <DashboardSection title="Recent Enquiries" viewAllHref="/admin/enquiries">
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-wide" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Related</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((e) => (
                  <tr key={`${e.source}-${e.id}`} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td className="px-4 py-3 text-white/80">{e.name}</td>
                    <td className="px-4 py-3 text-white/50">{e.related || "—"}</td>
                    <td className="px-4 py-3 text-white/50">{e.contact || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}

      {/* F. Community & Content Health */}
      {communityHealth && (
        <DashboardSection title="Community & Content Health">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <MiniStat label="Posts Today" value={communityHealth.postsToday} />
            <MiniStat label="Reels Today" value={communityHealth.reelsToday} />
            <MiniStat label="Comments Today" value={communityHealth.commentsToday} />
            <MiniStat label="Reported Content" value={communityHealth.reportedContentCount} />
            <MiniStat label="Hidden Content" value={communityHealth.hiddenContentCount} />
            <MiniStat label="Banned Users" value={communityHealth.bannedUsersCount} />
            <MiniStat label="Active Communities" value={communityHealth.activeCommunitiesCount} />
          </div>
          {communityHealth.topCreators.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-white font-semibold text-sm mb-3">Top Creators This Week</h3>
              <div className="space-y-2">
                {communityHealth.topCreators.map((c) => (
                  <div key={c.user_id} className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{c.full_name || "Unnamed"}</span>
                    <span className="text-white/40">{c.post_count} posts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DashboardSection>
      )}

      {/* G. System Health */}
      <DashboardSection title="System Health">
        <SystemHealthCard health={systemHealth} />
      </DashboardSection>

      <div className="rounded-2xl p-5 flex flex-wrap gap-3" style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.15)" }}>
        <p className="text-white/60 text-sm w-full">Public website links — open to verify changes are live:</p>
        {["/", "/trips", "/expeditions", "/special", "/videos"].map((path) => (
          <a
            key={path}
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-full font-medium"
            style={{ background: "rgba(249,115,22,0.12)", color: "#F97316" }}
          >
            {path === "/" ? "Homepage" : path.replace("/", "")}
          </a>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-white/40 text-xs uppercase tracking-wide mb-1">{label}</div>
      <div className="text-white text-xl font-bold">{value}</div>
    </div>
  );
}
