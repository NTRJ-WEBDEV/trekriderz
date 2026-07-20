"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const ACCENT = "#F97316";
const CHART_DAYS = 14;

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function bucketByDay(dates: string[]): { date: string; count: number }[] {
  const today = new Date();
  const byDay: Record<string, number> = {};
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    byDay[toDateStr(d)] = 0;
  }
  dates.forEach((iso) => {
    const day = iso.split("T")[0];
    if (day in byDay) byDay[day]++;
  });
  return Object.entries(byDay).map(([date, count]) => ({ date, count }));
}

function GrowthChart({ title, data }: { title: string; data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        <span className="text-xs text-white/40">{total} in {CHART_DAYS}d</span>
      </div>
      <div className="flex items-end gap-1" style={{ height: 70 }}>
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 1)}%`, background: `${ACCENT}99`, minHeight: 2 }} title={`${fmtDate(d.date)}: ${d.count}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface LeaderRow { label: string; sublabel?: string; value: string | number; }
function Leaderboard({ title, rows }: { title: string; rows: LeaderRow[] }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="px-5 py-3 text-white font-semibold text-sm" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{title}</div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-white/30 text-sm">No data yet.</div>
      ) : (
        <div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-white/20 text-xs w-4">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-white text-sm truncate">{r.label}</div>
                  {r.sublabel && <div className="text-white/30 text-xs truncate">{r.sublabel}</div>}
                </div>
              </div>
              <span className="font-bold text-sm shrink-0" style={{ color: ACCENT }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState<Record<string, { date: string; count: number }[]>>({});
  const [topGuides, setTopGuides] = useState<LeaderRow[]>([]);
  const [topLocations, setTopLocations] = useState<LeaderRow[]>([]);
  const [topActivities, setTopActivities] = useState<LeaderRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setDate(since.getDate() - CHART_DAYS);
      const sinceIso = since.toISOString();

      const [users, posts, reels, stories, trips, bookings, postReports, contentReports, guides, tripRows] = await Promise.all([
        supabase.from("users").select("created_at").gte("created_at", sinceIso),
        supabase.from("posts").select("created_at").is("post_type", null).gte("created_at", sinceIso),
        supabase.from("posts").select("created_at").eq("post_type", "reel").gte("created_at", sinceIso),
        supabase.from("stories_24h").select("created_at").gte("created_at", sinceIso),
        supabase.from("trips").select("created_at").gte("created_at", sinceIso),
        supabase.from("bookings").select("created_at").gte("created_at", sinceIso),
        supabase.from("post_reports").select("created_at").gte("created_at", sinceIso),
        supabase.from("content_reports").select("created_at").gte("created_at", sinceIso),
        supabase.from("guides").select("full_name, name, rating, total_reviews").eq("status", "approved").order("rating", { ascending: false, nullsFirst: false }).limit(5),
        supabase.from("trips").select("destination, trip_type"),
      ]);

      setCharts({
        users: bucketByDay((users.data || []).map((r: any) => r.created_at)),
        posts: bucketByDay((posts.data || []).map((r: any) => r.created_at)),
        reels: bucketByDay((reels.data || []).map((r: any) => r.created_at)),
        stories: bucketByDay((stories.data || []).map((r: any) => r.created_at)),
        trips: bucketByDay((trips.data || []).map((r: any) => r.created_at)),
        bookings: bucketByDay((bookings.data || []).map((r: any) => r.created_at)),
        reports: bucketByDay([...(postReports.data || []), ...(contentReports.data || [])].map((r: any) => r.created_at)),
      });

      setTopGuides((guides.data || []).map((g: any) => ({ label: g.full_name || g.name || "Unnamed", sublabel: `${g.total_reviews || 0} reviews`, value: g.rating ? `★ ${g.rating.toFixed(1)}` : "—" })));

      const destCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};
      (tripRows.data || []).forEach((t: any) => {
        if (t.destination) destCounts[t.destination] = (destCounts[t.destination] || 0) + 1;
        if (t.trip_type) typeCounts[t.trip_type] = (typeCounts[t.trip_type] || 0) + 1;
      });
      setTopLocations(Object.entries(destCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value: `${value} trips` })));
      setTopActivities(Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value: `${value} trips` })));

      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Analytics</h1>
        <p className="text-white/40 text-sm mt-0.5">Platform growth over the last {CHART_DAYS} days.</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/30">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <GrowthChart title="Users Growth" data={charts.users} />
            <GrowthChart title="Posts" data={charts.posts} />
            <GrowthChart title="Reels" data={charts.reels} />
            <GrowthChart title="Stories" data={charts.stories} />
            <GrowthChart title="Trips Created" data={charts.trips} />
            <GrowthChart title="Bookings" data={charts.bookings} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <GrowthChart title="Reports Filed" data={charts.reports} />
            <div className="rounded-2xl p-5 flex flex-col justify-center items-center text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}>
              <div className="text-white/30 text-xs uppercase tracking-wide mb-1">Revenue</div>
              <div className="text-xl font-bold text-white/20">— Phase 6 —</div>
              <p className="text-white/20 text-xs mt-1">No finance calculations yet, by design.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Leaderboard title="Top Guides" rows={topGuides} />
            <Leaderboard title="Top Locations" rows={topLocations} />
            <Leaderboard title="Top Trip Types" rows={topActivities} />
          </div>
        </>
      )}
    </div>
  );
}
