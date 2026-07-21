export default function ReviewSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-pulse">
      <div className="h-4 w-32 rounded bg-white/5 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-video rounded-2xl bg-white/5" />
          <div className="h-6 w-2/3 rounded bg-white/5" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
        <div className="h-64 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
