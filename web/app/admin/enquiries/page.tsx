"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const STATUS_COLORS: any = {
  new: { bg: "rgba(249,115,22,0.15)", color: "#F97316" },
  contacted: { bg: "rgba(59,130,246,0.15)", color: "#3B82F6" },
  booked: { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
  closed: { bg: "rgba(107,114,128,0.15)", color: "#9CA3AF" },
  responded: { bg: "rgba(139,92,246,0.15)", color: "#8B5CF6" },
};
const STATUSES = ["all", "new", "contacted", "booked", "closed"];

export default function EnquiriesPage() {
  const supabase = createClient();
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [custom, setCustom] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"trips" | "custom">("trips");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const [eq, cu] = await Promise.all([
      supabase.from("enquiries").select("*").order("created_at", { ascending: false }),
      supabase.from("custom_enquiries").select("*").order("created_at", { ascending: false }),
    ]);
    setEnquiries(eq.data || []);
    setCustom(cu.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string, table = "enquiries") => {
    await supabase.from(table).update({ status }).eq("id", id);
    load();
    if (selected?.id === id) setSelected((s: any) => ({ ...s, status }));
  };

  const exportCSV = () => {
    const rows = (tab === "trips" ? enquiries : custom);
    const cols = tab === "trips"
      ? ["name", "whatsapp", "trip_name", "group_size", "preferred_date", "message", "status", "created_at"]
      : ["name", "whatsapp", "budget_range", "destination_type", "group_size", "duration", "preferred_month", "status", "created_at"];
    const header = cols.join(",");
    const body = rows.map(r => cols.map(c => `"${(r[c] || "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `enquiries-${tab}-${Date.now()}.csv`; a.click();
  };

  const data = (tab === "trips" ? enquiries : custom).filter(e => filter === "all" || e.status === filter);
  const waLink = (n: string) => `https://wa.me/${n?.replace(/\D/g, "")}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Enquiries Inbox</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {enquiries.filter(e => e.status === "new").length} new trip enquiries · {custom.filter(e => e.status === "new").length} new custom plans
          </p>
        </div>
        <button onClick={exportCSV} className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          ↓ Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["trips", "custom"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: tab === t ? "#F97316" : "rgba(255,255,255,0.06)", color: tab === t ? "#0A0E27" : "rgba(255,255,255,0.6)" }}>
            {t === "trips" ? `Trip Enquiries (${enquiries.length})` : `Custom Plans (${custom.length})`}
          </button>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
            style={{ background: filter === s ? "#F97316" : "rgba(255,255,255,0.06)", color: filter === s ? "#0A0E27" : "rgba(255,255,255,0.5)" }}>
            {s} {s !== "all" ? `(${(tab === "trips" ? enquiries : custom).filter(e => e.status === s).length})` : ""}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-20 text-white/30">Loading…</div> : (
        <div className="space-y-3">
          {data.length === 0 ? (
            <div className="text-center py-16 text-white/30">No enquiries found</div>
          ) : data.map(e => (
            <div key={e.id} className="rounded-2xl p-5 cursor-pointer hover:border-white/15 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${e.status === "new" ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.08)"}` }}
              onClick={() => setSelected(e)}>
              <div className="flex flex-wrap gap-4 items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>
                    {(e.name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{e.name}</div>
                    <div className="text-white/50 text-xs mt-0.5">
                      {tab === "trips" ? (e.trip_name || "No trip specified") : (e.destination_type || "Custom")}
                      {e.group_size ? ` · ${e.group_size} pax` : ""}
                      {e.preferred_date ? ` · ${e.preferred_date}` : ""}
                    </div>
                    {e.message && <div className="text-white/35 text-xs mt-1 line-clamp-1">{e.message}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-white/30 text-xs">{fmtDate(e.created_at)}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold capitalize"
                    style={STATUS_COLORS[e.status] || STATUS_COLORS.new}>
                    {e.status}
                  </span>
                  {e.whatsapp && (
                    <a href={waLink(e.whatsapp)} target="_blank" rel="noopener noreferrer"
                      onClick={ev => ev.stopPropagation()}
                      className="px-3 py-1 rounded-lg text-xs font-bold"
                      style={{ background: "#25D366", color: "#fff" }}>
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setSelected(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ["WhatsApp", selected.whatsapp],
                ["Email", selected.email],
                ["Trip", selected.trip_name || selected.destination_type],
                ["Group Size", selected.group_size],
                ["Date", selected.preferred_date || selected.preferred_month],
                ["Budget", selected.budget_range],
                ["Message", selected.message],
                ["Submitted", fmtDate(selected.created_at)],
              ].map(([k, v]) => v ? (
                <div key={String(k)} className="flex gap-3">
                  <span className="text-white/40 w-24 shrink-0">{k}</span>
                  <span className="text-white/80">{String(v)}</span>
                </div>
              ) : null)}
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {["new", "contacted", "booked", "closed"].map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s, tab === "trips" ? "enquiries" : "custom_enquiries")}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize"
                  style={{ background: selected.status === s ? "#F97316" : "rgba(255,255,255,0.08)", color: selected.status === s ? "#0A0E27" : "#fff" }}>
                  {s}
                </button>
              ))}
              {selected.whatsapp && (
                <a href={waLink(selected.whatsapp)} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold ml-auto"
                  style={{ background: "#25D366", color: "#fff" }}>
                  Open WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
