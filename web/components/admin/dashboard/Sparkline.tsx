// Decorative trend line only — this codebase doesn't compute a real daily
// time-series for most KPIs yet, and the brief explicitly calls for a
// placeholder rather than blocking the whole card on that. Never labeled
// as real data; purely visual texture next to a real count + real delta.
const POINTS = "0,20 10,15 20,17 30,10 40,12 50,6 60,9 70,4 80,7 90,2 100,5";

export default function Sparkline({ positive = true }: { positive?: boolean }) {
  return (
    <svg viewBox="0 0 100 24" className="w-full h-6" preserveAspectRatio="none">
      <polyline
        points={positive ? POINTS : POINTS.split(" ").reverse().join(" ")}
        fill="none"
        stroke={positive ? "#8CC63F" : "#6B7280"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
    </svg>
  );
}
