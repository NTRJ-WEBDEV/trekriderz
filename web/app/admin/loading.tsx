export default function AdminLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="h-7 w-64 rounded-lg bg-white/5 animate-pulse mb-2" />
        <div className="h-4 w-96 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white/5 animate-pulse" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
    </div>
  );
}
