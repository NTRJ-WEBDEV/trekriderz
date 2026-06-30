"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminOverview() {
  const [stats, setStats] = useState({ trips: 0, enquiries: 0, newEnquiries: 0, stories: 0, videos: 0, vehicles: 0, places: 0 });
  const [recentEnquiries, setRecentEnquiries] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const [t, eq, ne, s, v, ve, p, recent] = await Promise.all([
        supabase.from("trips").select("id", { count: "exact", head: true }),
        supabase.from("enquiries").select("id", { count: "exact", head: true }),
        supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("stories").select("id", { count: "exact", head: true }),
        supabase.from("youtube_videos").select("id", { count: "exact", head: true }),
        supabase.from("rental_vehicles").select("id", { count: "exact", head: true }),
        supabase.from("places_guide").select("id", { count: "exact", head: true }),
        supabase.from("enquiries").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({ trips: t.count || 0, enquiries: eq.count || 0, newEnquiries: ne.count || 0, stories: s.count || 0, videos: v.count || 0, vehicles: ve.count || 0, places: p.count || 0 });
      setRecentEnquiries(recent.data || []);
    };
    load();
  }, []);

  const CARDS = [
    { label: "Trips", value: stats.trips, icon: "🗺️", href: "/admin/trips", color: "#F97316" },
    { label: "Enquiries", value: stats.enquiries, icon: "📩", href: "/admin/enquiries", color: "#10B981", badge: stats.newEnquiries },
    { label: "Stories", value: stats.stories, icon: "📖", href: "/admin/stories", color: "#6366F1" },
    { label: "Videos", value: stats.videos, icon: "🎬", href: "/admin/videos", color: "#EF4444" },
    { label: "Vehicles", value: stats.vehicles, icon: "🏍️", href: "/admin/vehicles", color: "#8B5CF6" },
    { label: "Places", value: stats.places, icon: "📍", href: "/admin/places", color: "#0EA5E9" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Welcome back — here's what's happening on TrekRiderz.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {CARDS.map(c => (
          <Link key={c.href} href={c.href}
            className="rounded-2xl p-4 hover:scale-105 transition-transform cursor-pointer"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className="flex items-baseline gap-1">
              <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
              {c.badge ? (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${c.color}20`, color: c.color }}>{c.badge} new</span>
              ) : null}
            </div>
            <div className="text-white/40 text-xs mt-1 uppercase tracking-wider">{c.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: "Add new trip", href: "/admin/trips?new=1", icon: "+" },
              { label: "View enquiries", href: "/admin/enquiries", icon: "📩" },
              { label: "Add YouTube video", href: "/admin/videos", icon: "🎬" },
              { label: "Update site settings", href: "/admin/settings", icon: "⚙️" },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-base">{a.icon}</span>
                <span>{a.label}</span>
                <span className="ml-auto text-white/30">→</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Recent Enquiries</h2>
            <Link href="/admin/enquiries" className="text-xs" style={{ color: "#F97316" }}>View all →</Link>
          </div>
          {recentEnquiries.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-6">No enquiries yet</p>
          ) : (
            <div className="space-y-3">
              {recentEnquiries.map(e => (
                <div key={e.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>
                    {(e.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{e.name}</div>
                    <div className="text-white/40 text-xs truncate">{e.trip_name || e.message || "—"}</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: e.status === "new" ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.06)", color: e.status === "new" ? "#F97316" : "rgba(255,255,255,0.4)" }}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Links to public website */}
      <div className="rounded-2xl p-5 flex flex-wrap gap-3" style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.15)" }}>
        <p className="text-white/60 text-sm w-full">🌐 Public website links — open to verify changes are live:</p>
        {["/", "/trips", "/expeditions", "/special", "/videos"].map(path => (
          <a key={path} href={path} target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-full font-medium"
            style={{ background: "rgba(249,115,22,0.12)", color: "#F97316" }}>
            {path === "/" ? "Homepage" : path.replace("/", "")}
          </a>
        ))}
      </div>
    </div>
  );
}
