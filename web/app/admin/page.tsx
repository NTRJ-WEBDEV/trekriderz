import pkg from "../../package.json";
import { getAdminSession } from "@/lib/supabase-server";
import {
  getOperationsInbox, getTodayKpis, getBusinessKpis, getRecentActivity, getUpcomingOperations,
  getTodaysOperations, getRecentEnquiries, getCommunityHealth, getSystemHealth, getChampionsPreview,
} from "@/lib/services/DashboardService";
import MissionControlHeader from "@/components/admin/dashboard/MissionControlHeader";
import DashboardSection from "@/components/admin/dashboard/DashboardSection";
import AttentionCard from "@/components/admin/dashboard/AttentionCard";
import KPIStatCard from "@/components/admin/dashboard/KPIStatCard";
import ActivityTimeline from "@/components/admin/dashboard/ActivityTimeline";
import ChampionsLeaderboard from "@/components/admin/dashboard/ChampionsLeaderboard";
import UpcomingTripOpsCard from "@/components/admin/dashboard/UpcomingTripOpsCard";
import SystemHealthCard from "@/components/admin/dashboard/SystemHealthCard";
import QuickActionGrid from "@/components/admin/dashboard/QuickActionGrid";
import DashboardDateFilter from "@/components/admin/dashboard/DashboardDateFilter";
import PlaceholderStatCard from "@/components/admin/dashboard/PlaceholderStatCard";
import DashboardFooter from "@/components/admin/dashboard/DashboardFooter";
import StatusBadge from "@/components/admin/StatusBadge";
import Link from "next/link";
import { glassCard, HOVER_LIFT } from "@/lib/adminTheme";

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

  const [
    inbox, kpis, businessKpis, activity, todaysOps, upcoming, enquiries, communityHealth, systemHealth, champions,
  ] = await Promise.all([
    getOperationsInbox(hasPermission),
    getTodayKpis(hasPermission),
    getBusinessKpis(hasPermission),
    getRecentActivity(hasPermission),
    getTodaysOperations(hasPermission),
    getUpcomingOperations(hasPermission, horizonDays),
    getRecentEnquiries(hasPermission),
    getCommunityHealth(hasPermission),
    getSystemHealth(),
    getChampionsPreview(hasPermission, 10),
  ]);

  const kpiByKey = Object.fromEntries(kpis.map((k) => [k.key, k]));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-2">
        <MissionControlHeader name={profile?.name || profile?.email} hasPermission={hasPermission} />
      </div>
      <div className="flex justify-end -mt-6 mb-8">
        <DashboardDateFilter />
      </div>

      {/* Attention Required */}
      {inbox.length > 0 && (
        <DashboardSection title="Attention Required" subtitle="What needs action right now.">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {inbox.map((card) => <AttentionCard key={card.key} card={card} />)}
          </div>
        </DashboardSection>
      )}

      {/* Recent Enquiries — "whether customers need replies" */}
      {enquiries.length > 0 && (
        <DashboardSection title="Recent Enquiries" viewAllHref="/admin/enquiries">
          <div className={`rounded-2xl overflow-hidden ${HOVER_LIFT}`} style={glassCard}>
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

      {/* Today's Operations */}
      {(todaysOps.today.length > 0 || todaysOps.tomorrow.length > 0) && (
        <DashboardSection title="Today's Operations" subtitle="Trips departing today and tomorrow." viewAllHref="/admin/expeditions">
          {todaysOps.today.length > 0 && (
            <>
              <div className="text-white/40 text-xs uppercase tracking-wide mb-2">Today</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {todaysOps.today.map((e) => <UpcomingTripOpsCard key={e.id} expedition={e} />)}
              </div>
            </>
          )}
          {todaysOps.tomorrow.length > 0 && (
            <>
              <div className="text-white/40 text-xs uppercase tracking-wide mb-2">Tomorrow</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {todaysOps.tomorrow.map((e) => <UpcomingTripOpsCard key={e.id} expedition={e} />)}
              </div>
            </>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <PlaceholderStatCard label="Vehicles Assigned" />
            <PlaceholderStatCard label="Packing Reminders Sent" />
            <PlaceholderStatCard label="Weather Warnings" />
          </div>
        </DashboardSection>
      )}

      {/* Business KPIs */}
      {businessKpis.length > 0 && (
        <DashboardSection title="Business KPIs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {businessKpis.map((kpi) => <KPIStatCard key={kpi.key} kpi={kpi} showSparkline />)}
          </div>
        </DashboardSection>
      )}

      {/* Community Health */}
      {(communityHealth || kpiByKey["active_users"]) && (
        <DashboardSection title="Community Health">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiByKey["active_users"] && <KPIStatCard kpi={kpiByKey["active_users"]} />}
            {kpiByKey["new_users"] && <KPIStatCard kpi={{ ...kpiByKey["new_users"], label: "New Members" }} />}
            {kpiByKey["posts"] && <KPIStatCard kpi={kpiByKey["posts"]} />}
            {kpiByKey["reels"] && <KPIStatCard kpi={kpiByKey["reels"]} />}
            {kpiByKey["stories"] && <KPIStatCard kpi={{ ...kpiByKey["stories"], label: "Travel Stories" }} />}
            {communityHealth && (
              <KPIStatCard kpi={{ key: "comments", label: "Comments", value: communityHealth.commentsToday, delta: null }} />
            )}
            <PlaceholderStatCard label="Retention" />
            <PlaceholderStatCard label="Avg. Session" />
            <PlaceholderStatCard label="Most Active Category" />
          </div>
        </DashboardSection>
      )}

      {/* Closed Beta Champions */}
      {champions.campaign && (
        <DashboardSection title="Closed Beta Champions" subtitle={champions.campaign.name}>
          <ChampionsLeaderboard rows={champions.candidates} />
          <div className="flex gap-2 mt-4">
            <Link href="/admin/community-champions" className={`px-4 py-2 rounded-xl text-xs font-semibold ${HOVER_LIFT}`} style={{ background: "rgba(140,198,63,0.15)", color: "#8CC63F" }}>
              Recalculate Scores
            </Link>
            <Link href="/admin/community-champions" className={`px-4 py-2 rounded-xl text-xs font-semibold text-white/70 ${HOVER_LIFT}`} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Approve Rewards
            </Link>
            <Link href="/admin/community-champions" className={`px-4 py-2 rounded-xl text-xs font-semibold text-white/70 ${HOVER_LIFT}`} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Export CSV
            </Link>
          </div>
        </DashboardSection>
      )}

      {/* Live Activity Timeline */}
      {hasPermission("activity_log.view") && (
        <DashboardSection title="Live Activity Timeline">
          <div className={`rounded-2xl p-6 ${HOVER_LIFT}`} style={glassCard}>
            <ActivityTimeline rows={activity} />
          </div>
        </DashboardSection>
      )}

      {/* Upcoming Trips */}
      {upcoming.length > 0 && (
        <DashboardSection title="Upcoming Trips" subtitle={`Departing in the next ${horizonDays} days.`} viewAllHref="/admin/expeditions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((e) => <UpcomingTripOpsCard key={e.id} expedition={e} />)}
          </div>
        </DashboardSection>
      )}

      {/* Platform Health */}
      <DashboardSection title="Platform Health">
        <SystemHealthCard health={systemHealth} />
      </DashboardSection>

      {/* Trending */}
      <DashboardSection title="Trending" subtitle="Search and engagement analytics aren't wired up yet — shown for layout completeness.">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <PlaceholderStatCard label="Most Searched Destinations" />
          <PlaceholderStatCard label="Trending Trips" />
          <PlaceholderStatCard label="Trending Reels" />
          <PlaceholderStatCard label="Popular Guides" />
          <PlaceholderStatCard label="Popular Homestays" />
        </div>
      </DashboardSection>

      {/* Quick Actions */}
      <DashboardSection title="Quick Actions">
        <QuickActionGrid hasPermission={hasPermission} />
      </DashboardSection>

      <DashboardFooter version={pkg.version} commit={systemHealth.deployment.commit} env={systemHealth.deployment.env} />
    </div>
  );
}
