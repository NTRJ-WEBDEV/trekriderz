export interface ReelCardData {
  id: string;
  content: string | null;
  media: string[] | null;
  likes_count: number;
  authorName?: string | null;
}

// The website never plays reel video inline (mobile-only autoplay
// experience) — this is a discovery teaser that deep-links back to the
// app, matching "the website should NOT duplicate the mobile app."
export default function ReelCard({ reel }: { reel: ReelCardData }) {
  const thumb = reel.media?.[0];
  return (
    <div className="glass-card rounded-2xl overflow-hidden relative aspect-[9/16] group">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <video src={thumb} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
      ) : (
        <div className="absolute inset-0 img-placeholder">
          <span className="text-3xl opacity-30">🎞️</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xl">▶</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {reel.content && <p className="text-white/80 text-xs line-clamp-2 mb-1">{reel.content}</p>}
        <p className="text-white/40 text-[10px]">{reel.authorName ? `@${reel.authorName}` : ""} · ❤️ {reel.likes_count}</p>
      </div>
    </div>
  );
}
