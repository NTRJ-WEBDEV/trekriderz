"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_PASSWORD = "trekriderz2026";

type Tab = "overview" | "enquiries" | "bookings" | "users" | "expeditions" | "trips" | "moderation" | "videos";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString("en-IN"); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function wa(num: string) { return `https://wa.me/${num.replace(/\D/g, "")}`; }

const STATUS_COLORS: Record<string, string> = {
  new: "bg-accent/20 text-accent",
  responded: "bg-white/10 text-white/40",
  closed: "bg-white/5 text-white/20",
  pending: "bg-yellow-500/20 text-yellow-400",
  confirmed: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  cancelled: "bg-red-900/30 text-red-300",
  completed: "bg-blue-500/20 text-blue-400",
  approved: "bg-green-500/20 text-green-400",
  active: "bg-green-500/20 text-green-400",
  published: "bg-accent/20 text-accent",
  draft: "bg-white/10 text-white/40",
  sold_out: "bg-red-500/20 text-red-400",
  inactive: "bg-white/5 text-white/20",
  paid: "bg-green-500/20 text-green-400",
  unpaid: "bg-yellow-500/20 text-yellow-400",
  refunded: "bg-purple-500/20 text-purple-400",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || "bg-white/10 text-white/40"}`}>
      {status}
    </span>
  );
}

const BLANK_TRIP = { name: "", type: "trek", country: "India", destination: "", duration_days: 3, price_inr: 0, difficulty: "moderate", status: "active", special_tag: "", whatsapp_link: "" };

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);

  // data
  const [overview, setOverview] = useState<Record<string, number>>({});
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [customEnquiries, setCustomEnquiries] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [expeditions, setExpeditions] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [homestays, setHomestays] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);

  const [editingTrip, setEditingTrip] = useState<any>(null);
  const [tripForm, setTripForm] = useState<any>({ ...BLANK_TRIP });
  const [videoForm, setVideoForm] = useState({ title: "", youtube_url: "", category: "shorts" });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("total_price").eq("payment_status", "paid"),
      supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("custom_enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("guides").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("homestays").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("guided_expeditions").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "active"),
      // detail data
      supabase.from("enquiries").select("*").order("created_at", { ascending: false }),
      supabase.from("custom_enquiries").select("*").order("created_at", { ascending: false }),
      supabase.from("bookings").select("*, user:user_id(full_name,avatar_url)").order("created_at", { ascending: false }).limit(100),
      supabase.from("users").select("id,full_name,email,role,created_at,avatar_url").order("created_at", { ascending: false }).limit(200),
      supabase.from("guided_expeditions").select("*, guide:guides(name,is_premium)").order("created_at", { ascending: false }),
      supabase.from("trips").select("*").order("created_at", { ascending: false }),
      supabase.from("guides").select("*, user:user_id(full_name,avatar_url)").order("created_at", { ascending: false }),
      supabase.from("homestays").select("*, owner:owner_id(full_name,avatar_url)").order("created_at", { ascending: false }),
      supabase.from("youtube_videos").select("*").order("created_at", { ascending: false }),
    ]);

    const get = (i: number) => results[i].status === "fulfilled" ? (results[i] as any).value : null;

    const paidBookings: any[] = get(2)?.data || [];
    const revenue = paidBookings.reduce((sum: number, b: any) => sum + (b.total_price || 0), 0);

    setOverview({
      users: get(0)?.count || 0,
      bookings: get(1)?.count || 0,
      revenue,
      newEnquiries: (get(3)?.count || 0) + (get(4)?.count || 0),
      pendingApprovals: (get(5)?.count || 0) + (get(6)?.count || 0),
      activeExpeditions: get(7)?.count || 0,
      activeWebTrips: get(8)?.count || 0,
    });

    setEnquiries(get(9)?.data || []);
    setCustomEnquiries(get(10)?.data || []);
    setBookings(get(11)?.data || []);
    setUsers(get(12)?.data || []);
    setExpeditions(get(13)?.data || []);
    setTrips(get(14)?.data || []);
    setGuides(get(15)?.data || []);
    setHomestays(get(16)?.data || []);
    setVideos(get(17)?.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (auth) loadAll(); }, [auth, loadAll]);

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="glass-card rounded-3xl p-10 w-full max-w-sm text-center">
          <div className="font-display text-4xl mb-1">
            <span className="text-white">TREK</span><span className="text-accent">RIDERZ</span>
          </div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-8">Admin Dashboard</p>
          <form onSubmit={(e) => { e.preventDefault(); if (pw === ADMIN_PASSWORD) { setAuth(true); setPwError(false); } else setPwError(true); }} className="space-y-4">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Admin password" autoFocus className="form-input text-sm text-center" />
            {pwError && <p className="text-red-400 text-xs">Incorrect password</p>}
            <button type="submit" className="w-full btn-accent py-3 rounded-full font-bold">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const markEnquiry = async (id: string, status: string, table = "enquiries") => {
    await supabase.from(table).update({ status }).eq("id", id);
    loadAll();
  };

  const updateStatus = async (table: string, id: string, status: string) => {
    await supabase.from(table).update({ status, ...(status === "approved" ? { verified_at: new Date().toISOString() } : {}) }).eq("id", id);
    loadAll();
  };

  const updateUserRole = async (id: string, role: string) => {
    await supabase.from("users").update({ role }).eq("id", id);
    loadAll();
  };

  const saveTrip = async () => {
    if (editingTrip?.id) await supabase.from("trips").update(tripForm).eq("id", editingTrip.id);
    else await supabase.from("trips").insert(tripForm);
    setEditingTrip(null); setTripForm({ ...BLANK_TRIP }); loadAll();
  };

  const deleteTrip = async (id: string) => {
    if (!confirm("Delete this trip?")) return;
    await supabase.from("trips").delete().eq("id", id); loadAll();
  };

  const addVideo = async () => {
    if (!videoForm.title || !videoForm.youtube_url) return;
    const url = videoForm.youtube_url.trim();
    const vid = url.includes("youtu.be/") ? url.split("youtu.be/")[1]?.split("?")[0]
      : url.split("v=")[1]?.split("&")[0] || url;
    const embed = url.includes("/shorts/")
      ? `https://www.youtube.com/embed/${url.split("/shorts/")[1]?.split("?")[0]}`
      : `https://www.youtube.com/embed/${vid}`;
    await supabase.from("youtube_videos").insert({ title: videoForm.title, youtube_url: url, embed_url: embed, category: videoForm.category });
    setVideoForm({ title: "", youtube_url: "", category: "shorts" }); loadAll();
  };

  const deleteVideo = async (id: string) => { await supabase.from("youtube_videos").delete().eq("id", id); loadAll(); };

  // ── Tab config ─────────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "overview", label: "📊 Overview" },
    { key: "enquiries", label: "📩 Enquiries", badge: overview.newEnquiries },
    { key: "bookings", label: "🏕️ Bookings", badge: bookings.filter(b => b.status === "pending").length },
    { key: "users", label: "👤 Users", badge: 0 },
    { key: "expeditions", label: "⛰️ Expeditions", badge: 0 },
    { key: "trips", label: "🗺️ Web Trips", badge: 0 },
    { key: "moderation", label: "✅ Moderation", badge: overview.pendingApprovals },
    { key: "videos", label: "🎬 Videos", badge: 0 },
  ];

  return (
    <div className="min-h-screen pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl text-white">ADMIN DASHBOARD</h1>
            <p className="text-white/30 text-xs mt-0.5">TrekRiderz · NTRJ WEBDEV PVT LTD · Web + Mobile</p>
          </div>
          <button onClick={loadAll} className="btn-ghost px-4 py-2 rounded-full text-xs font-medium">
            {loading ? "⟳ Loading..." : "⟳ Refresh"}
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${tab === t.key ? "bg-accent text-dark-900" : "glass text-white/60 hover:text-white"}`}>
              {t.label}
              {(t.badge || 0) > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? "bg-dark-900/20" : "bg-accent/20 text-accent"}`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Users", value: fmt(overview.users || 0), icon: "👤", color: "text-blue-400" },
                { label: "Total Bookings", value: fmt(overview.bookings || 0), icon: "🏕️", color: "text-accent" },
                { label: "Paid Revenue", value: `₹${fmt(overview.revenue || 0)}`, icon: "💰", color: "text-green-400" },
                { label: "New Enquiries", value: fmt(overview.newEnquiries || 0), icon: "📩", color: "text-yellow-400" },
                { label: "Pending Approvals", value: fmt(overview.pendingApprovals || 0), icon: "⏳", color: "text-orange-400" },
                { label: "Active Expeditions", value: fmt(overview.activeExpeditions || 0), icon: "⛰️", color: "text-accent" },
                { label: "Active Web Trips", value: fmt(overview.activeWebTrips || 0), icon: "🗺️", color: "text-purple-400" },
                { label: "YouTube Videos", value: fmt(videos.length), icon: "🎬", color: "text-red-400" },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-2xl p-5">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className={`font-display text-3xl ${s.color}`}>{s.value}</div>
                  <div className="text-white/40 text-xs mt-1 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent enquiries snapshot */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-display text-2xl text-white mb-4">RECENT ENQUIRIES</h2>
              <div className="space-y-3">
                {[...enquiries, ...customEnquiries]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 5)
                  .map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <span className="text-white text-sm font-medium">{e.name}</span>
                        <span className="text-white/40 text-xs ml-2">{e.trip_name || e.destination_type || "Custom Plan"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <a href={wa(e.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-accent text-xs hover:underline">{e.whatsapp}</a>
                        <Badge status={e.status} />
                        <span className="text-white/30 text-xs">{fmtDate(e.created_at)}</span>
                      </div>
                    </div>
                  ))}
              </div>
              {(overview.newEnquiries || 0) > 5 && (
                <button onClick={() => setTab("enquiries")} className="mt-4 text-accent text-xs hover:underline">
                  View all {overview.newEnquiries} new enquiries →
                </button>
              )}
            </div>

            {/* Pending approvals snapshot */}
            {(overview.pendingApprovals || 0) > 0 && (
              <div className="glass-card rounded-2xl p-6 border border-yellow-500/20">
                <h2 className="font-display text-2xl text-yellow-400 mb-1">⚠️ PENDING APPROVALS</h2>
                <p className="text-white/50 text-sm mb-4">
                  {guides.filter(g => g.status === "pending").length} guides · {homestays.filter(h => h.status === "pending").length} homestays waiting for review
                </p>
                <button onClick={() => setTab("moderation")} className="btn-accent px-6 py-2 rounded-full text-sm font-bold">
                  Go to Moderation →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ENQUIRIES (Web trip + Custom plans combined) ───────────────── */}
        {tab === "enquiries" && (
          <div className="space-y-6">
            {/* Trip enquiries */}
            <div>
              <h2 className="font-display text-3xl text-white mb-4">TRIP ENQUIRIES
                <span className="text-white/30 text-lg ml-2">({enquiries.filter(e => e.status === "new").length} new)</span>
              </h2>
              <div className="glass-card rounded-2xl overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10 text-white/30 text-xs uppercase tracking-wider">
                      <th className="text-left p-4">Name</th>
                      <th className="text-left p-4">Trip</th>
                      <th className="text-left p-4">WhatsApp</th>
                      <th className="text-left p-4 hidden lg:table-cell">Group / Date</th>
                      <th className="text-left p-4 hidden xl:table-cell">Message</th>
                      <th className="text-left p-4">Date</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enquiries.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-white/30">No enquiries yet</td></tr>}
                    {enquiries.map((e) => (
                      <tr key={e.id} className={`border-b border-white/5 hover:bg-white/2 ${e.status === "new" ? "bg-accent/2" : ""}`}>
                        <td className="p-4 font-medium text-white">{e.name}</td>
                        <td className="p-4 text-white/60 text-xs">{e.trip_name || "—"}</td>
                        <td className="p-4">
                          <a href={wa(e.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-accent text-xs hover:underline">{e.whatsapp}</a>
                        </td>
                        <td className="p-4 hidden lg:table-cell text-white/50 text-xs">{e.group_size}p · {e.preferred_date || "—"}</td>
                        <td className="p-4 hidden xl:table-cell text-white/40 text-xs max-w-[180px] truncate">{e.message || "—"}</td>
                        <td className="p-4 text-white/30 text-xs">{fmtDate(e.created_at)}</td>
                        <td className="p-4">
                          {e.status === "new"
                            ? <button onClick={() => markEnquiry(e.id, "responded")} className="btn-accent px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">Mark Responded</button>
                            : <Badge status={e.status} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Custom plan enquiries */}
            <div>
              <h2 className="font-display text-3xl text-white mb-4">CUSTOM TRIP PLANS
                <span className="text-white/30 text-lg ml-2">({customEnquiries.filter(e => e.status === "new").length} new)</span>
              </h2>
              <div className="space-y-3">
                {customEnquiries.length === 0 && <div className="glass-card rounded-2xl py-10 text-center text-white/30">No custom plans yet</div>}
                {customEnquiries.map((e) => (
                  <div key={e.id} className={`glass-card rounded-2xl p-5 ${e.status === "new" ? "border-accent/20" : ""}`}>
                    <div className="flex flex-wrap gap-4 items-start justify-between">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm flex-1">
                        <div>
                          <p className="text-white/30 text-xs mb-0.5">Contact</p>
                          <p className="text-white font-medium">{e.name}</p>
                          <a href={wa(e.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-accent text-xs hover:underline">{e.whatsapp}</a>
                        </div>
                        <div>
                          <p className="text-white/30 text-xs mb-0.5">Budget · Type</p>
                          <p className="text-white text-xs">{e.budget_range}</p>
                          <p className="text-white/60 text-xs capitalize">{e.destination_type}</p>
                        </div>
                        <div>
                          <p className="text-white/30 text-xs mb-0.5">Countries</p>
                          <p className="text-white text-xs">{(e.countries || []).join(", ") || "Any"}</p>
                        </div>
                        <div>
                          <p className="text-white/30 text-xs mb-0.5">Details</p>
                          <p className="text-white text-xs">{e.group_size}p · {e.duration} · {e.preferred_month}</p>
                          <p className="text-white/50 text-xs capitalize">Fitness: {e.fitness_level}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge status={e.status} />
                        {e.status === "new" && (
                          <button onClick={() => markEnquiry(e.id, "responded", "custom_enquiries")} className="btn-accent px-3 py-1 rounded-full text-xs font-bold">
                            Responded
                          </button>
                        )}
                        <p className="text-white/30 text-xs">{fmtDate(e.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── BOOKINGS (Mobile app) ─────────────────────────────────────── */}
        {tab === "bookings" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-3xl text-white">BOOKINGS
                <span className="text-white/30 text-lg ml-2">({bookings.length} total)</span>
              </h2>
              <div className="text-right">
                <p className="text-accent font-bold">₹{fmt(overview.revenue || 0)}</p>
                <p className="text-white/30 text-xs">paid revenue</p>
              </div>
            </div>

            {/* Summary pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {["pending", "confirmed", "completed", "cancelled", "rejected"].map((s) => {
                const count = bookings.filter(b => b.status === s).length;
                return count > 0 ? (
                  <span key={s} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_COLORS[s]}`}>
                    {count} {s}
                  </span>
                ) : null;
              })}
            </div>

            <div className="glass-card rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/30 text-xs uppercase tracking-wider">
                    <th className="text-left p-4">User</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-left p-4">Dates</th>
                    <th className="text-left p-4">Guests</th>
                    <th className="text-left p-4">Amount</th>
                    <th className="text-left p-4">Payment</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Booked</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-white/30">No bookings yet</td></tr>}
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="p-4">
                        <p className="text-white font-medium text-sm">{b.user?.full_name || "Unknown"}</p>
                      </td>
                      <td className="p-4">
                        <span className="text-xs capitalize text-white/70">{b.resource_type}</span>
                      </td>
                      <td className="p-4 text-white/50 text-xs">{b.start_date} → {b.end_date}</td>
                      <td className="p-4 text-white/60 text-xs">{b.guests_count}</td>
                      <td className="p-4 text-accent font-bold">₹{fmt(b.total_price)}</td>
                      <td className="p-4"><Badge status={b.payment_status} /></td>
                      <td className="p-4"><Badge status={b.status} /></td>
                      <td className="p-4 text-white/30 text-xs">{fmtDate(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS ────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-3xl text-white">USERS
                <span className="text-white/30 text-lg ml-2">({users.length})</span>
              </h2>
              <div className="flex gap-2 text-xs">
                {["user", "guide", "homestay_owner", "admin"].map(role => (
                  <span key={role} className="glass px-2 py-1 rounded-full text-white/50 capitalize">
                    {users.filter(u => u.role === role).length} {role.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/30 text-xs uppercase tracking-wider">
                    <th className="text-left p-4">Name</th>
                    <th className="text-left p-4 hidden md:table-cell">Email</th>
                    <th className="text-left p-4">Role</th>
                    <th className="text-left p-4 hidden md:table-cell">Joined</th>
                    <th className="p-4">Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-white/30">No users yet</td></tr>}
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                            {u.full_name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <span className="text-white font-medium">{u.full_name || "—"}</span>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell text-white/50 text-xs">{u.email || "—"}</td>
                      <td className="p-4"><Badge status={u.role || "user"} /></td>
                      <td className="p-4 hidden md:table-cell text-white/30 text-xs">{fmtDate(u.created_at)}</td>
                      <td className="p-4">
                        <select
                          value={u.role || "user"}
                          onChange={(e) => updateUserRole(u.id, e.target.value)}
                          className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-accent/40"
                        >
                          {["user", "guide", "homestay_owner", "admin"].map(r => (
                            <option key={r} value={r} className="bg-dark-800">{r}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EXPEDITIONS (Mobile app guided expeditions) ───────────────── */}
        {tab === "expeditions" && (
          <div>
            <h2 className="font-display text-3xl text-white mb-4">GUIDED EXPEDITIONS
              <span className="text-white/30 text-lg ml-2">(mobile app)</span>
            </h2>
            <div className="glass-card rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/30 text-xs uppercase tracking-wider">
                    <th className="text-left p-4">Expedition</th>
                    <th className="text-left p-4">Guide</th>
                    <th className="text-left p-4">Destination</th>
                    <th className="text-left p-4">Duration</th>
                    <th className="text-left p-4">Seats</th>
                    <th className="text-left p-4">Status</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expeditions.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-white/30">No expeditions yet</td></tr>}
                  {expeditions.map((exp) => (
                    <tr key={exp.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="p-4">
                        <p className="text-white font-medium">{exp.title}</p>
                        <p className="text-white/40 text-xs capitalize">{exp.difficulty}</p>
                      </td>
                      <td className="p-4 text-white/60 text-xs">
                        {exp.guide?.name || "—"}
                        {exp.guide?.is_premium && <span className="text-accent ml-1">★</span>}
                      </td>
                      <td className="p-4 text-white/60 text-xs">{exp.destination}</td>
                      <td className="p-4 text-white/60 text-xs">{exp.duration_days}D</td>
                      <td className="p-4 text-white/60 text-xs">{exp.available_seats}/{exp.max_seats}</td>
                      <td className="p-4"><Badge status={exp.status} /></td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {exp.status === "draft" && (
                            <button onClick={() => updateStatus("guided_expeditions", exp.id, "published")} className="btn-accent px-2 py-1 rounded-full text-xs font-bold">Publish</button>
                          )}
                          {exp.status === "published" && (
                            <button onClick={() => updateStatus("guided_expeditions", exp.id, "cancelled")} className="glass px-2 py-1 rounded-full text-xs hover:text-red-400">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── WEB TRIPS CRUD ───────────────────────────────────────────── */}
        {tab === "trips" && (
          <div className="space-y-6">
            {editingTrip !== null && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-display text-2xl text-white mb-5">{editingTrip.id ? "EDIT TRIP" : "ADD NEW TRIP"}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { k: "name", label: "Trip Name", type: "text" },
                    { k: "destination", label: "Destination", type: "text" },
                    { k: "whatsapp_link", label: "WhatsApp Link", type: "text" },
                    { k: "special_tag", label: "Special Tag", type: "text" },
                    { k: "duration_days", label: "Duration (days)", type: "number" },
                    { k: "price_inr", label: "Price INR", type: "number" },
                  ].map(({ k, label, type }) => (
                    <div key={k}>
                      <label className="text-white/40 text-xs mb-1 block">{label}</label>
                      <input type={type} value={tripForm[k] || ""} onChange={(e) => setTripForm((f: any) => ({ ...f, [k]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))} className="form-input text-sm" />
                    </div>
                  ))}
                  {[
                    { k: "type", label: "Type", opts: ["trek", "tour", "stay", "special"] },
                    { k: "country", label: "Country", opts: ["India", "Nepal", "Bhutan", "Philippines", "Indonesia", "Cambodia"] },
                    { k: "difficulty", label: "Difficulty", opts: ["easy", "moderate", "challenging", "extreme"] },
                    { k: "status", label: "Status", opts: ["active", "inactive", "sold_out", "draft"] },
                  ].map(({ k, label, opts }) => (
                    <div key={k}>
                      <label className="text-white/40 text-xs mb-1 block">{label}</label>
                      <select value={tripForm[k] || ""} onChange={(e) => setTripForm((f: any) => ({ ...f, [k]: e.target.value }))} className="form-input text-sm">
                        {opts.map(o => <option key={o} value={o} className="bg-dark-800">{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={saveTrip} className="btn-accent px-6 py-2.5 rounded-full font-bold text-sm">{editingTrip.id ? "Save Changes" : "Add Trip"}</button>
                  <button onClick={() => { setEditingTrip(null); setTripForm({ ...BLANK_TRIP }); }} className="btn-ghost px-6 py-2.5 rounded-full text-sm font-bold">Cancel</button>
                </div>
              </div>
            )}
            {editingTrip === null && (
              <button onClick={() => { setEditingTrip({}); setTripForm({ ...BLANK_TRIP }); }} className="btn-accent px-6 py-2.5 rounded-full font-bold text-sm">
                + Add New Trip
              </button>
            )}
            <div className="glass-card rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/30 text-xs uppercase tracking-wider">
                    <th className="text-left p-4">Trip</th>
                    <th className="text-left p-4 hidden md:table-cell">Country</th>
                    <th className="text-left p-4 hidden md:table-cell">Price</th>
                    <th className="text-left p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-white/30">No trips yet</td></tr>}
                  {trips.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="p-4">
                        <p className="font-medium text-white">{t.name}</p>
                        <p className="text-white/40 text-xs">{t.destination} · {t.duration_days}D</p>
                      </td>
                      <td className="p-4 hidden md:table-cell text-white/60 text-xs">{t.country}</td>
                      <td className="p-4 hidden md:table-cell text-accent font-semibold">{t.price_inr ? `₹${fmt(t.price_inr)}` : "—"}</td>
                      <td className="p-4"><Badge status={t.status} /></td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => { setEditingTrip(t); setTripForm(t); }} className="glass px-3 py-1 rounded-full text-xs hover:border-accent/30 hover:text-accent">Edit</button>
                          <button onClick={() => deleteTrip(t.id)} className="glass px-3 py-1 rounded-full text-xs hover:border-red-500/30 hover:text-red-400">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MODERATION ───────────────────────────────────────────────── */}
        {tab === "moderation" && (
          <div className="space-y-8">
            {[
              { label: "GUIDES", items: guides, type: "guides", nameKey: "name", subKey: "location", ownerKey: "user" },
              { label: "HOMESTAYS", items: homestays, type: "homestays", nameKey: "name", subKey: "location", ownerKey: "owner" },
            ].map(({ label, items, type, nameKey, subKey, ownerKey }) => (
              <div key={type}>
                <h2 className="font-display text-3xl text-white mb-4">{label}
                  <span className="text-yellow-400 text-lg ml-2">({items.filter((i: any) => i.status === "pending").length} pending)</span>
                </h2>
                <div className="glass-card rounded-2xl overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-white/10 text-white/30 text-xs uppercase tracking-wider">
                        <th className="text-left p-4">Name</th>
                        <th className="text-left p-4 hidden md:table-cell">{type === "guides" ? "Guide" : "Owner"}</th>
                        <th className="text-left p-4 hidden md:table-cell">Location</th>
                        <th className="text-left p-4">Date</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-white/30">No {type}</td></tr>}
                      {items.map((item: any) => (
                        <tr key={item.id} className={`border-b border-white/5 ${item.status === "pending" ? "bg-yellow-500/2" : ""}`}>
                          <td className="p-4 text-white font-medium">{item[nameKey]}</td>
                          <td className="p-4 hidden md:table-cell text-white/50 text-xs">{item[ownerKey]?.full_name || "—"}</td>
                          <td className="p-4 hidden md:table-cell text-white/50 text-xs">{item[subKey] || "—"}</td>
                          <td className="p-4 text-white/30 text-xs">{fmtDate(item.created_at)}</td>
                          <td className="p-4">
                            {item.status === "pending" ? (
                              <div className="flex gap-2 justify-center">
                                <button onClick={() => updateStatus(type, item.id, "approved")} className="btn-accent px-3 py-1 rounded-full text-xs font-bold">Approve</button>
                                <button onClick={() => updateStatus(type, item.id, "rejected")} className="glass px-3 py-1 rounded-full text-xs hover:text-red-400">Reject</button>
                              </div>
                            ) : <Badge status={item.status} />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── VIDEOS ───────────────────────────────────────────────────── */}
        {tab === "videos" && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-display text-2xl text-white mb-4">ADD YOUTUBE VIDEO</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input placeholder="Video title" value={videoForm.title} onChange={(e) => setVideoForm(f => ({ ...f, title: e.target.value }))} className="form-input text-sm" />
                <input placeholder="YouTube URL or Shorts URL" value={videoForm.youtube_url} onChange={(e) => setVideoForm(f => ({ ...f, youtube_url: e.target.value }))} className="form-input text-sm" />
                <select value={videoForm.category} onChange={(e) => setVideoForm(f => ({ ...f, category: e.target.value }))} className="form-input text-sm">
                  <option value="shorts" className="bg-dark-800">YouTube Shorts</option>
                  <option value="timelapse" className="bg-dark-800">Time-lapse</option>
                  <option value="full" className="bg-dark-800">Full video</option>
                </select>
              </div>
              <button onClick={addVideo} className="mt-4 btn-accent px-6 py-2.5 rounded-full font-bold text-sm">Add Video</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.length === 0 && <div className="glass-card rounded-2xl py-10 text-center text-white/30 col-span-2">No videos added yet</div>}
              {videos.map((v) => (
                <div key={v.id} className="glass-card rounded-2xl p-4 flex gap-4 items-center">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{v.title}</p>
                    <p className="text-white/40 text-xs truncate">{v.youtube_url}</p>
                    <span className="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full mt-1 inline-block">{v.category}</span>
                  </div>
                  <button onClick={() => deleteVideo(v.id)} className="glass px-3 py-1.5 rounded-full text-xs hover:border-red-500/30 hover:text-red-400 shrink-0">Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
