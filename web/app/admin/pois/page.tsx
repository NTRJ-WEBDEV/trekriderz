"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/services/AuditService";

interface Poi {
  id: string;
  name: string;
  category: string;
  description: string | null;
  lat: number;
  lng: number;
  images: string[] | null;
  submitted_by: string | null;
  created_at: string;
}

interface SubmitterInfo {
  email: string | null;
  full_name: string | null;
}

// Mirrors the category emoji/label lookups in mobile/components/ExploreMapView.tsx
// and mobile/app/map/index.tsx — kept in sync manually since web and mobile are
// separate codebases with no shared module.
const CATEGORY_META: Record<string, { emoji: string; label: string; color: string }> = {
  waterfall: { emoji: "💧", label: "Waterfall", color: "#0EA5E9" },
  viewpoint: { emoji: "🌄", label: "Viewpoint", color: "#F59E0B" },
  peak: { emoji: "⛰️", label: "Peak", color: "#78716C" },
  campsite: { emoji: "⛺", label: "Campsite", color: "#16A34A" },
  temple: { emoji: "🛕", label: "Temple", color: "#DC2626" },
  other: { emoji: "📍", label: "Other", color: "#6B7280" },
};

export default function PoiSubmissionsPage() {
  const supabase = createClient();
  const [pois, setPois] = useState<Poi[]>([]);
  const [submitters, setSubmitters] = useState<Record<string, SubmitterInfo>>({});
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Poi | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pois")
      .select("id, name, category, description, lat, lng, images, submitted_by, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const rows = data || [];
    setPois(rows);

    const ids = Array.from(new Set(rows.map((r) => r.submitted_by).filter(Boolean))) as string[];
    if (ids.length > 0) {
      const { data: users } = await supabase.from("users").select("id, email, full_name").in("id", ids);
      const map: Record<string, SubmitterInfo> = {};
      (users || []).forEach((u: any) => { map[u.id] = { email: u.email, full_name: u.full_name }; });
      setSubmitters(map);
    } else {
      setSubmitters({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (poi: Poi) => {
    setActioningId(poi.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("pois")
      .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", poi.id);

    if (error) {
      showToast(`Failed to approve: ${error.message}`);
    } else {
      setPois((prev) => prev.filter((p) => p.id !== poi.id));
      showToast(`"${poi.name}" approved — now live on the map`);
      await logAdminAction({ action: "poi.approved", entityType: "poi", entityId: poi.id, newValue: { status: "approved" } });
    }
    setActioningId(null);
  };

  const openReject = (poi: Poi) => {
    setRejectTarget(poi);
    setRejectReason("");
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActioningId(rejectTarget.id);
    const { error } = await supabase
      .from("pois")
      .update({ status: "rejected", rejection_reason: rejectReason.trim() })
      .eq("id", rejectTarget.id);

    if (error) {
      showToast(`Failed to reject: ${error.message}`);
    } else {
      setPois((prev) => prev.filter((p) => p.id !== rejectTarget.id));
      showToast(`"${rejectTarget.name}" rejected`);
      await logAdminAction({ action: "poi.rejected", entityType: "poi", entityId: rejectTarget.id, reason: rejectReason.trim(), newValue: { status: "rejected" } });
    }
    setActioningId(null);
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl" style={{ background: "#10B981", color: "#fff" }}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">POI Submissions</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {pois.length} pending {pois.length === 1 ? "place" : "places"} — waterfalls, viewpoints, peaks, campsites and
            other trekking spots submitted by users.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/30">Loading…</div>
      ) : pois.length === 0 ? (
        <div className="text-center py-16 text-white/30">No pending submissions. All caught up. 🎉</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pois.map((p) => {
            const meta = CATEGORY_META[p.category] || CATEGORY_META.other;
            const submitter = p.submitted_by ? submitters[p.submitted_by] : null;
            const photo = p.images && p.images.length > 0 ? p.images[0] : null;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
            const busy = actioningId === p.id;

            return (
              <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex">
                  {photo ? (
                    <img src={photo} alt={p.name} className="w-28 object-cover shrink-0" style={{ minHeight: 100 }} />
                  ) : (
                    <div className="w-28 flex items-center justify-center shrink-0 text-3xl" style={{ background: "rgba(255,255,255,0.04)", minHeight: 100 }}>
                      {meta.emoji}
                    </div>
                  )}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-white font-semibold truncate">{p.name}</div>
                        <div className="text-xs mt-0.5 font-bold" style={{ color: meta.color }}>{meta.emoji} {meta.label}</div>
                      </div>
                    </div>

                    {p.description && (
                      <p className="text-white/50 text-xs mt-2 line-clamp-3">{p.description}</p>
                    )}

                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs mt-2 inline-block" style={{ color: "#F97316" }}>
                      📍 {p.lat.toFixed(5)}, {p.lng.toFixed(5)} — view on map ↗
                    </a>

                    <div className="text-white/30 text-[11px] mt-2">
                      Submitted by {submitter?.full_name || submitter?.email || "Unknown user"} · {fmtDate(p.created_at)}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleApprove(p)} disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                        style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>
                        {busy ? "…" : "Approve"}
                      </button>
                      <button onClick={() => openReject(p)} disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 className="text-white font-bold mb-1">Reject "{rejectTarget.name}"?</h3>
            <p className="text-white/50 text-sm mb-4">Let the submitter know why. This is required.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. Duplicate of an existing pin, location too imprecise, not a real place…"
              className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none resize-none mb-4"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <div className="flex gap-3">
              <button onClick={submitReject} disabled={!rejectReason.trim() || actioningId === rejectTarget.id}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{ background: "#EF4444", color: "#fff" }}>
                {actioningId === rejectTarget.id ? "Rejecting…" : "Reject Submission"}
              </button>
              <button onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
