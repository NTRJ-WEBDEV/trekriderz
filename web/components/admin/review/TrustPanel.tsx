"use client";
import { useState } from "react";
import { ShieldCheck, ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { RawTrustFactors, AdminTrustBreakdown, TrustEvent } from "@/lib/services/TrustEngineService";

interface TrustPanelProps {
  factors: RawTrustFactors | null;
  breakdown: AdminTrustBreakdown | null;
  events: TrustEvent[];
  canManage: boolean;
  onLogPolicyViolation: (description: string) => Promise<void>;
}

const IMPACT_ICON: Record<string, any> = { positive: TrendingUp, negative: TrendingDown, neutral: Minus };
const IMPACT_COLOR: Record<string, string> = { positive: "#22C55E", negative: "#EF4444", neutral: "#9CA3AF" };

// Internal Trust Panel — PARTNER_PLATFORM.md §7, Phase 1. Admin-only.
// Every number here traces to a specific factor in RawTrustFactors; the
// "why" (AdminTrustBreakdown) is computed by TrustEngineService, not
// invented in this component. Never a public-facing score, badge, or
// ranking — this label is deliberately "Internal Trust Health," not
// "Trust Score."
export default function TrustPanel({ factors, breakdown, events, canManage, onLogPolicyViolation }: TrustPanelProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!factors || !breakdown) {
    return (
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-white/30 text-sm">Trust factors unavailable.</p>
      </div>
    );
  }

  const handleLogNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onLogPolicyViolation(note.trim());
      setNote("");
      setNoteOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold text-sm">Internal Trust Health</h3>
        <span className="text-[9px] uppercase tracking-wide text-white/25">Admin-only · not shown to travellers</span>
      </div>

      <div className="flex items-center gap-2 mb-4 mt-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: breakdown.overallHealth.color }} />
        <span className="text-lg font-bold" style={{ color: breakdown.overallHealth.color }}>{breakdown.overallHealth.label}</span>
        <span className="text-white/40 text-xs">— {breakdown.overallHealth.summary}</span>
      </div>

      {/* Factor breakdown — every value with its explanation, never bare */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {breakdown.factors.map((f) => (
          <div key={f.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="text-white/35 text-[10px] uppercase tracking-wide mb-1">{f.label}</div>
            <div className="text-white text-sm font-semibold mb-0.5">{f.value}</div>
            <div className="text-white/30 text-[11px] leading-snug">{f.explanation}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Section title="Strengths" items={breakdown.strengths} color="#22C55E" icon={ShieldCheck} />
        <Section title="Weaknesses" items={breakdown.weaknesses} color="#EF4444" icon={ShieldAlert} />
        <Section title="Missing Verification" items={breakdown.missingVerification} color="#F59E0B" />
        <Section title="Upcoming Risks" items={breakdown.upcomingRisks} color="#F59E0B" />
      </div>

      {breakdown.expiredDocuments.length > 0 && (
        <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="text-red-400 text-xs font-semibold mb-1">Expired Documents</div>
          {breakdown.expiredDocuments.map((d, i) => <div key={i} className="text-white/60 text-xs">{d}</div>)}
        </div>
      )}

      {/* Historical trend — the real chronological event log, not a computed score-over-time chart (no snapshot history exists yet, see recommendations) */}
      <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wide">Historical Trend</h4>
          {canManage && (
            <button onClick={() => setNoteOpen((o) => !o)} className="text-[11px] px-2 py-1 rounded-lg font-medium" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
              Log Policy Note
            </button>
          )}
        </div>
        {noteOpen && (
          <div className="flex gap-2 mb-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe the policy concern observed…"
              className="flex-1 rounded-lg px-3 py-2 text-white text-xs outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            <button onClick={handleLogNote} disabled={saving} className="text-xs px-3 py-2 rounded-lg font-semibold disabled:opacity-50" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
              {saving ? "Saving…" : "Log"}
            </button>
          </div>
        )}
        {events.length === 0 ? (
          <p className="text-white/25 text-xs">No trust events recorded yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {events.map((e) => {
              const Icon = IMPACT_ICON[e.impact];
              return (
                <div key={e.id} className="flex items-center gap-2 text-xs">
                  <Icon size={12} style={{ color: IMPACT_COLOR[e.impact] }} className="shrink-0" />
                  <span className="text-white/60 flex-1">{e.description}</span>
                  <span className="text-white/25 shrink-0">{new Date(e.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, items, color, icon: Icon }: { title: string; items: string[]; color: string; icon?: any }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color }}>
        {Icon && <Icon size={12} />}{title}
      </div>
      {items.length === 0 ? (
        <p className="text-white/20 text-[11px]">None</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => <li key={i} className="text-white/50 text-[11px] leading-snug">{item}</li>)}
        </ul>
      )}
    </div>
  );
}
