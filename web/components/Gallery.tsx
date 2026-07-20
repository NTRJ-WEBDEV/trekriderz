export default function Gallery({ images, emptyLabel = "Photos coming soon" }: { images: string[]; emptyLabel?: string }) {
  if (images.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl img-placeholder flex-col gap-1">
            <span className="text-xl opacity-20">📸</span>
            <span className="text-[9px]">{emptyLabel}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={`Gallery photo ${i + 1}`} loading="lazy" className="aspect-square rounded-xl object-cover w-full h-full" />
      ))}
    </div>
  );
}
