"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

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

export default function UsersPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [dailyCounts, setDailyCounts] = useState<{ date: string; count: number }[]>([]);
  const [active7, setActive7] = useState(0);
  const [active14, setActive14] = useState(0);
  const [testers, setTesters] = useState<TesterStat[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("days_active");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hoverDay, setHoverDay] = useState<string | null>(null);

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
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Users</h1>
        <p className="text-white/40 text-sm mt-0.5">Registered users, daily activity, and your most active testers.</p>
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
          <div
            className="rounded-2xl p-5 mb-8"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
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
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                    onMouseEnter={() => setHoverDay(d.date)}
                    onMouseLeave={() => setHoverDay(null)}
                  >
                    <div
                      className="w-full rounded-t-[4px] transition-opacity"
                      style={{
                        height: `${Math.max(heightPct, d.count > 0 ? 4 : 1)}%`,
                        background: isToday ? ACCENT : `${ACCENT}99`,
                        opacity: hoverDay && hoverDay !== d.date ? 0.5 : 1,
                        minHeight: 2,
                      }}
                    />
                    <span className="text-[9px] text-white/30 mt-1.5 whitespace-nowrap">{fmtDate(d.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tester table */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
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
                      <tr
                        key={t.user_id}
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          background: isTop12 ? "rgba(249,115,22,0.06)" : undefined,
                        }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isTop12 && <span title="Top 12 most active">🏆</span>}
                            <div>
                              <div className="text-white font-medium">{t.full_name || "Unnamed"}</div>
                              <div className="text-white/30 text-xs">{t.email || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-bold" style={{ color: isTop12 ? ACCENT : "#fff" }}>
                          {t.days_active}
                        </td>
                        <td className="px-5 py-3 text-white/50">{fmtDate(t.first_seen)}</td>
                        <td className="px-5 py-3 text-white/50">{fmtDate(t.last_seen)}</td>
                      </tr>
                    );
                  })}
                  {sortedTesters.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-white/30">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
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
