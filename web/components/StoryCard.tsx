import Link from "next/link";

export interface StoryCardData {
  id: string;
  title: string;
  slug: string;
  destination: string | null;
  cover_image_url: string | null;
  body?: string | null;
  created_at: string;
  authorName?: string | null;
}

function readingTime(body?: string | null): number {
  if (!body) return 1;
  return Math.max(1, Math.round(body.split(/\s+/).length / 200));
}

export default function StoryCard({ story }: { story: StoryCardData }) {
  return (
    <Link href={`/stories/${story.slug}`} className="group block">
      <div className="glass-card rounded-2xl overflow-hidden hover:border-accent/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(173,255,47,0.08)]">
        <div className="relative h-48 w-full img-placeholder">
          {story.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.cover_image_url} alt={story.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 img-placeholder flex-col gap-2">
              <span className="text-3xl opacity-30">📖</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-transparent" />
        </div>
        <div className="p-5">
          <h3 className="font-bold text-white text-base leading-tight group-hover:text-accent transition-colors line-clamp-2 mb-2">{story.title}</h3>
          <p className="text-white/40 text-xs">
            {story.destination && <>{story.destination} · </>}
            {readingTime(story.body)} min read
            {story.authorName && <> · by {story.authorName}</>}
          </p>
        </div>
      </div>
    </Link>
  );
}
