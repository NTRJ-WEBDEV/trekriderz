"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { suspendUser, banUser, unbanUser } from "@/lib/services/ModerationService";
import { logAdminAction } from "@/lib/services/AuditService";
import { useAdminPermissions } from "@/lib/adminPermissions";
import DataTable, { Column } from "@/components/admin/DataTable";
import TableToolbar from "@/components/admin/TableToolbar";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";

const ACCENT = "#F97316";
const CHART_DAYS = 14;

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface ActivityRow {
  user_id: string;
  activity_date: string;
}

interface TesterStat {
  user_id: string;
  full_name: string | null;
  email: string | null;
  days_active: number;
  first_seen: string;
  last_seen: string;
}

type SortKey = "name" | "days_active" | "first_seen" | "last_seen";

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ── Directory ──────────────────────────────────────────────────────────
interface DirectoryUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  is_verified: boolean;
  is_banned: boolean;
  ban_expires_at: string | null;
  warning_count: number;
  created_at: string;
  followerCount: number;
  postCount: number;
  lastActive: string | null;
}

const ROLES = ["user", "guide", "homestay_owner", "admin"] as const;
const DIR_PAGE_SIZE = 20;

export default function UsersPage() {
  const supabase = createClient();
  const { hasPermission } = useAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [dailyCounts, setDailyCounts] = useState<{ date: string; count: number }[]>([]);
  const [active7, setActive7] = useState(0);
  const [active14, setActive14] = useState(0);
  const [testers, setTesters] = useState<TesterStat[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("days_active");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  // Directory state
  const [dirRows, setDirRows] = useState<DirectoryUser[]>([]);
  const [dirTotal, setDirTotal] = useState(0);
  const [dirPage, setDirPage] = useState(1);
  const [dirLoading, setDirLoading] = useState(true);
  const [dirSearch, setDirSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [roleModalUser, setRoleModalUser] = useState<DirectoryUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<DirectoryUser | null>(null);
  const [banTarget, setBanTarget] = useState<DirectoryUser | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);

    const { count } = await supabase.from("users").select("id", { count: "exact", head: true });
    setTotalUsers(count || 0);

    const [{ data: activityRows }, { data: userRows }] = await Promise.all([
      supabase.from("user_daily_activity").select("user_id, activity_date"),
      supabase.from("users").select("id, full_name, email"),
    ]);

    const userMap: Record<string, UserProfile> = {};
    (userRows || []).forEach((u: any) => {
      userMap[u.id] = { id: u.id, full_name: u.full_name, email: u.email };
    });

    const rows = (activityRows as ActivityRow[]) || [];

    // Per-tester stats are all-time — mirrors scripts/most-active-testers.sql exactly.
    const perUserDates: Record<string, Set<string>> = {};
    rows.forEach((r) => {
      if (!perUserDates[r.user_id]) perUserDates[r.user_id] = new Set();
      perUserDates[r.user_id].add(r.activity_date);
    });

    const testerStats: TesterStat[] = Object.entries(perUserDates).map(([user_id, dateSet]) => {
      const dates = Array.from(dateSet).sort();
      return {
        user_id,
        full_name: userMap[user_id]?.full_name ?? null,
        email: userMap[user_id]?.email ?? null,
        days_active: dateSet.size,
        first_seen: dates[0],
        last_seen: dates[dates.length - 1],
      };
    });
    setTesters(testerStats);

    // Chart: per-day distinct-user counts, windowed to the last CHART_DAYS days, zero-filled.
    const today = new Date();
    const byDay: Record<string, Set<string>> = {};
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      byDay[toDateStr(d)] = new Set();
    }
    rows.forEach((r) => {
      if (byDay[r.activity_date]) byDay[r.activity_date].add(r.user_id);
    });
    setDailyCounts(Object.entries(byDay).map(([date, set]) => ({ date, count: set.size })));

    // Active (7d) / Active (14d): distinct users with >=1 activity day anywhere in
    // that trailing window (union across days, not a sum of daily counts).
    const cutoff7 = toDateStr(new Date(today.getTime() - 6 * 86400000));
    const cutoff14 = toDateStr(new Date(today.getTime() - 13 * 86400000));
    let count7 = 0;
    let count14 = 0;
    Object.values(perUserDates).forEach((dateSet) => {
      const dates = Array.from(dateSet);
      if (dates.some((d) => d >= cutoff14)) count14++;
      if (dates.some((d) => d >= cutoff7)) count7++;
    });
    setActive7(count7);
    setActive14(count14);

    setLoading(false);
  };

  const loadDirectory = useCallback(async () => {
    setDirLoading(true);
    let query = supabase.from("users").select("*", { count: "exact" });
    if (roleFilter) query = query.eq("role", roleFilter);
    if (statusFilter === "banned") query = query.eq("is_banned", true);
    else if (statusFilter === "active") query = query.eq("is_banned", false);
    if (verifiedFilter === "verified") query = query.eq("is_verified", true);
    else if (verifiedFilter === "unverified") query = query.eq("is_verified", false);
    if (dirSearch.trim()) query = query.or(`full_name.ilike.%${dirSearch}%,email.ilike.%${dirSearch}%`);
    query = query.order("created_at", { ascending: false }).range((dirPage - 1) * DIR_PAGE_SIZE, dirPage * DIR_PAGE_SIZE - 1);

    const { data, count } = await query;
    const users = (data as any[]) || [];
    const ids = users.map((u) => u.id);

    // Batched follower/post/last-active counts — one query per metric for
    // the whole page, not one per row.
    const [{ data: follows }, { data: posts }, { data: activity }] = await Promise.all([
      ids.length ? supabase.from("user_follows").select("following_id").in("following_id", ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from("posts").select("user_id").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from("user_daily_activity").select("user_id, activity_date").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
    ]);

    const followerCounts: Record<string, number> = {};
    (follows || []).forEach((f: any) => { followerCounts[f.following_id] = (followerCounts[f.following_id] || 0) + 1; });
    const postCounts: Record<string, number> = {};
    (posts || []).forEach((p: any) => { postCounts[p.user_id] = (postCounts[p.user_id] || 0) + 1; });
    const lastActiveMap: Record<string, string> = {};
    (activity || []).forEach((a: any) => {
      if (!lastActiveMap[a.user_id] || a.activity_date > lastActiveMap[a.user_id]) lastActiveMap[a.user_id] = a.activity_date;
    });

    setDirRows(users.map((u) => ({
      ...u,
      followerCount: followerCounts[u.id] || 0,
      postCount: postCounts[u.id] || 0,
      lastActive: lastActiveMap[u.id] || null,
    })));
    setDirTotal(count || 0);
    setDirLoading(false);
  }, [roleFilter, statusFilter, verifiedFilter, dirSearch, dirPage]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);
  useEffect(() => { setDirPage(1); }, [roleFilter, statusFilter, verifiedFilter, dirSearch]);

  const changeRole = async (u: DirectoryUser, role: string) => {
    const { error } = await supabase.from("users").update({ role }).eq("id", u.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: "user.role_changed", entityType: "user", entityId: u.id, previousValue: { role: u.role }, newValue: { role } });
    showToast(`Role updated to ${role}`);
    setRoleModalUser(null);
    loadDirectory();
  };

  const toggleVerify = async (u: DirectoryUser) => {
    const { error } = await supabase.from("users").update({ is_verified: !u.is_verified }).eq("id", u.id);
    if (error) { showToast(`Failed: ${error.message}`); return; }
    await logAdminAction({ action: u.is_verified ? "user.unverified" : "user.verified", entityType: "user", entityId: u.id, newValue: { is_verified: !u.is_verified } });
    loadDirectory();
  };

  const handleSuspend = async (reason?: string) => {
    if (!suspendTarget || !reason) return;
    try { await suspendUser(suspendTarget.id, reason); showToast("User suspended 7 days"); setSuspendTarget(null); loadDirectory(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleBan = async (reason?: string) => {
    if (!banTarget || !reason) return;
    try { await banUser(banTarget.id, reason); showToast("User banned"); setBanTarget(null); loadDirectory(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleUnban = async (u: DirectoryUser) => {
    try { await unbanUser(u.id); showToast("User unbanned"); loadDirectory(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const dirColumns: Column<DirectoryUser>[] = useMemo(() => [
    {
      key: "name", label: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
            {u.avatar_url && <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div>
            <div className="text-white font-medium flex items-center gap-1.5">{u.full_name || "Unnamed"}{u.is_verified && <span title="Verified" className="text-[11px]">✅</span>}</div>
            <div className="text-white/30 text-xs">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: "role", label: "Role", render: (u) => <span className="text-white/60 capitalize text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>{u.role}</span> },
    { key: "status", label: "Status", render: (u) => <StatusBadge status={u.is_banned ? "suspended" : "approved"} /> },
    { key: "warnings", label: "Warnings", render: (u) => u.warning_count > 0 ? <span style={{ color: "#F59E0B" }}>{u.warning_count}</span> : <span className="text-white/20">0</span> },
    { key: "followers", label: "Followers", render: (u) => <span className="text-white/60">{u.followerCount}</span> },
    { key: "posts", label: "Posts", render: (u) => <span className="text-white/60">{u.postCount}</span> },
    { key: "joined", label: "Joined", render: (u) => <span className="text-white/40 text-xs">{fmtDate(u.created_at.split("T")[0])}</span> },
    { key: "lastActive", label: "Last Active", render: (u) => <span className="text-white/40 text-xs">{u.lastActive ? fmtDate(u.lastActive) : "—"}</span> },
    {
      key: "actions", label: "Actions",
      render: (u) => (
        <div className="flex gap-1.5 flex-wrap">
          {hasPermission("users.role_manage") && <ActionBtn onClick={() => setRoleModalUser(u)}>Role</ActionBtn>}
          {hasPermission("users.verify") && <ActionBtn onClick={() => toggleVerify(u)}>{u.is_verified ? "Unverify" : "Verify"}</ActionBtn>}
          {hasPermission("users.ban") && !u.is_banned && <ActionBtn danger onClick={() => setSuspendTarget(u)}>Suspend</ActionBtn>}
          {hasPermission("users.ban") && !u.is_banned && <ActionBtn danger onClick={() => setBanTarget(u)}>Ban</ActionBtn>}
          {hasPermission("users.ban") && u.is_banned && <ActionBtn onClick={() => handleUnban(u)}>Unban</ActionBtn>}
        </div>
      ),
    },
  ], [hasPermission]);

  const todayStr = toDateStr(new Date());
  const dauToday = dailyCounts.find((d) => d.date === todayStr)?.count ?? 0;

  const top12Ids = useMemo(() => {
    return new Set(
      [...testers]
        .sort((a, b) => b.days_active - a.days_active)
        .slice(0, 12)
        .map((t) => t.user_id)
    );
  }, [testers]);

  const sortedTesters = useMemo(() => {
    const copy = [...testers];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
      } else if (sortKey === "days_active") {
        cmp = a.days_active - b.days_active;
      } else if (sortKey === "first_seen") {
        cmp = a.first_seen.localeCompare(b.first_seen);
      } else {
        cmp = a.last_seen.localeCompare(b.last_seen);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [testers, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count));
  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Users</h1>
          <p className="text-white/40 text-sm mt-0.5">Registered users, daily activity, and account management.</p>
        </div>
        {toast && <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/30">Loading…</div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatTile label="Total Users" value={totalUsers} />
            <StatTile label="Active Today" value={dauToday} />
            <StatTile label="Active (7d)" value={active7} />
            <StatTile label="Active (14d)" value={active14} />
          </div>

          {/* 14-day chart */}
          <div className="rounded-2xl p-5 mb-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-sm">Daily Active Users — last {CHART_DAYS} days</h2>
              {hoverDay && (
                <span className="text-xs font-bold" style={{ color: ACCENT }}>
                  {fmtDate(hoverDay)}: {dailyCounts.find((d) => d.date === hoverDay)?.count ?? 0} active
                </span>
              )}
            </div>
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {dailyCounts.map((d) => {
                const heightPct = (d.count / maxCount) * 100;
                const isToday = d.date === todayStr;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full"
                    onMouseEnter={() => setHoverDay(d.date)} onMouseLeave={() => setHoverDay(null)}>
                    <div className="w-full rounded-t-[4px] transition-opacity"
                      style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 1)}%`, background: isToday ? ACCENT : `${ACCENT}99`, opacity: hoverDay && hoverDay !== d.date ? 0.5 : 1, minHeight: 2 }} />
                    <span className="text-[9px] text-white/30 mt-1.5 whitespace-nowrap">{fmtDate(d.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full user directory */}
          <div className="mb-8">
            <h2 className="text-white font-semibold text-base mb-3">All Users</h2>
            <TableToolbar search={dirSearch} onSearchChange={setDirSearch} placeholder="Search by name or email…">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="">All roles</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="banned">Banned/Suspended</option>
              </select>
              <select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm text-white outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="">Verified + Unverified</option>
                <option value="verified">Verified only</option>
                <option value="unverified">Unverified only</option>
              </select>
            </TableToolbar>
            <DataTable columns={dirColumns} rows={dirRows} loading={dirLoading} emptyMessage="No users match these filters." page={dirPage} pageSize={DIR_PAGE_SIZE} total={dirTotal} onPageChange={setDirPage} />
          </div>

          {/* Tester table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-white font-semibold text-sm">All Testers</h2>
              <span className="text-[11px] text-white/30">🏆 top 12 by days active are highlighted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wide">
                    <Th onClick={() => handleSort("name")}>User{sortArrow("name")}</Th>
                    <Th onClick={() => handleSort("days_active")}>Days Active{sortArrow("days_active")}</Th>
                    <Th onClick={() => handleSort("first_seen")}>First Seen{sortArrow("first_seen")}</Th>
                    <Th onClick={() => handleSort("last_seen")}>Last Seen{sortArrow("last_seen")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTesters.map((t) => {
                    const isTop12 = top12Ids.has(t.user_id);
                    return (
                      <tr key={t.user_id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: isTop12 ? "rgba(249,115,22,0.06)" : undefined }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isTop12 && <span title="Top 12 most active">🏆</span>}
                            <div>
                              <div className="text-white font-medium">{t.full_name || "Unnamed"}</div>
                              <div className="text-white/30 text-xs">{t.email || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-bold" style={{ color: isTop12 ? ACCENT : "#fff" }}>{t.days_active}</td>
                        <td className="px-5 py-3 text-white/50">{fmtDate(t.first_seen)}</td>
                        <td className="px-5 py-3 text-white/50">{fmtDate(t.last_seen)}</td>
                      </tr>
                    );
                  })}
                  {sortedTesters.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-10 text-white/30">No activity recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setRoleModalUser(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#0F1420", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-base mb-4">Change role for {roleModalUser.full_name || roleModalUser.email}</h3>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <button key={r} onClick={() => changeRole(roleModalUser, r)}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm capitalize"
                  style={{ background: roleModalUser.role === r ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.05)", color: roleModalUser.role === r ? "#F97316" : "#fff" }}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => setRoleModalUser(null)} className="w-full mt-4 px-4 py-2 rounded-lg text-sm text-white/50">Cancel</button>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!suspendTarget} title={`Suspend ${suspendTarget?.full_name || "this user"} for 7 days?`} requireReason reasonLabel="Reason" confirmLabel="Suspend" danger onConfirm={handleSuspend} onCancel={() => setSuspendTarget(null)} />
      <ConfirmDialog open={!!banTarget} title={`Permanently ban ${banTarget?.full_name || "this user"}?`} requireReason reasonLabel="Reason" confirmLabel="Ban Permanently" danger onConfirm={handleBan} onCancel={() => setBanTarget(null)} />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-white/40 text-xs uppercase tracking-wide mb-1">{label}</div>
      <div className="text-white text-2xl font-bold">{value}</div>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <th className="px-5 py-3 text-left cursor-pointer select-none hover:text-white/70" onClick={onClick}>
      {children}
    </th>
  );
}

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
      style={{ background: danger ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)", color: danger ? "#EF4444" : "#fff" }}>
      {children}
    </button>
  );
}
