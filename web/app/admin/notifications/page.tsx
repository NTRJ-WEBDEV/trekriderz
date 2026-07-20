"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface Item { id: string; label: string; sublabel?: string; href: string; }
interface ActivityLogRow { id: string; action: string; entity_type: string; created_at: string; }

function actionLabel(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [guides, setGuides] = useState<Item[]>([]);
  const [homestays, setHomestays] = useState<Item[]>([]);
  const [vehicles, setVehicles] = useState<Item[]>([]);
  const [reports, setReports] = useState<Item[]>([]);
  const [recentApprovals, setRecentApprovals] = useState<ActivityLogRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const [g, h, v, pr, cr, log] = await Promise.all([
        supabase.from("guides").select("id, full_name, name").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
        supabase.from("properties").select("id, name, city").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
        supabase.from("rental_vehicles").select("id, make, model, vehicle_type").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
        supabase.from("post_reports").select("id, reason").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("content_reports").select("id, reason").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("admin_activity_log").select("*").like("action", "%.approved").order("created_at", { ascending: false }).limit(10),
      ]);

      setGuides((g.data || []).map((r: any) => ({ id: r.id, label: r.full_name || r.name || "Unnamed guide", href: "/admin/guides" })));
      setHomestays((h.data || []).map((r: any) => ({ id: r.id, label: r.name, sublabel: r.city, href: "/admin/homestays" })));
      setVehicles((v.data || []).map((r: any) => ({ id: r.id, label: [r.make, r.model].filter(Boolean).join(" ") || r.vehicle_type, href: "/admin/rentals" })));
      setReports([...(pr.data || []).map((r: any) => ({ id: r.id, label: r.reason, href: "/admin/reports" })), ...(cr.data || []).map((r: any) => ({ id: r.id, label: r.reason, href: "/admin/reports" }))]);
      setRecentApprovals((log.data as ActivityLogRow[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const totalPending = guides.length + homestays.length + vehicles.length + reports.length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Notifications</h1>
        <p className="text-white/40 text-sm mt-0.5">Everything waiting for a decision, in one place.</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/30">Loading…</div>
      ) : totalPending === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div className="text-3xl mb-2">✅</div>
          <p className="text-white/60">All caught up — nothing pending approval or review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <NotifSection title="New Guides Waiting" items={guides} />
          <NotifSection title="New Homestays Waiting" items={homestays} />
          <NotifSection title="New Vehicles Waiting" items={vehicles} />
          <NotifSection title="Open Reports" items={reports} />
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-5 py-3 text-white font-semibold text-sm" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Recently Completed</div>
        {recentApprovals.length === 0 ? (
          <div className="px-5 py-8 text-center text-white/30 text-sm">Nothing approved yet.</div>
        ) : (
          recentApprovals.map((a, i) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
              <span className="text-white/70 text-sm">{actionLabel(a.action)}</span>
              <span className="text-white/30 text-xs">{timeAgo(a.created_at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NotifSection({ title, items }: { title: string; items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-white font-semibold text-sm">{title}</span>
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>{items.length}</span>
      </div>
      {items.slice(0, 5).map((item, i) => (
        <Link key={item.id} href={item.href} className="flex items-center justify-between px-5 py-2.5 hover:bg-white/5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
          <div className="min-w-0">
            <div className="text-white/80 text-sm truncate">{item.label}</div>
            {item.sublabel && <div className="text-white/30 text-xs truncate">{item.sublabel}</div>}
          </div>
          <span className="text-white/20 text-xs shrink-0">→</span>
        </Link>
      ))}
    </div>
  );
}
