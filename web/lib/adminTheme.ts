// Shared visual tokens for the Mission Control dashboard homepage only.
// Every other admin page keeps its existing orange (#F97316) identity —
// this file exists so the ~10 dashboard components share one accent
// value and one "glass card" recipe instead of repeating magic strings.
export const ACCENT = "#8CC63F"; // TrekRiderz brand green (matches the mobile app accent)
export const ACCENT_SOFT = "rgba(140,198,63,0.12)";
export const ACCENT_BORDER = "rgba(140,198,63,0.3)";

export const URGENCY_COLORS = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#9CA3AF",
} as const;

export const glassCard = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
} as const;

export const glassCardAccent = {
  background: `linear-gradient(180deg, ${ACCENT_SOFT} 0%, rgba(255,255,255,0.02) 100%)`,
  border: `1px solid ${ACCENT_BORDER}`,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
} as const;

export const HOVER_LIFT = "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)]";
