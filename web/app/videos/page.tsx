import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

export const metadata = {
  title: "Videos | TrekRiderz — Trail Reels & Time-lapses",
  description:
    "Watch TrekRiderz trail reels, time-lapses, and adventure shorts from Western Ghats and beyond.",
};

const PLACEHOLDER_VIDEOS = [
  { id: "p1", title: "Coorg Coffee Trail Highlights", embed_url: "https://www.youtube.com/embed/dQw4w9WgXcQ", category: "shorts" },
  { id: "p2", title: "Western Ghats Trek 4K", embed_url: "https://www.youtube.com/embed/dQw4w9WgXcQ", category: "shorts" },
  { id: "p3", title: "Nepal Base Camp Journey", embed_url: "https://www.youtube.com/embed/dQw4w9WgXcQ", category: "shorts" },
  { id: "p4", title: "Bhutan Kingdom Tour 2025", embed_url: "https://www.youtube.com/embed/dQw4w9WgXcQ", category: "shorts" },
  { id: "p5", title: "Monsoon Trek Time-lapse", embed_url: "https://www.youtube.com/embed/dQw4w9WgXcQ", category: "timelapse" },
  { id: "p6", title: "Sunrise on Kodachadri", embed_url: "https://www.youtube.com/embed/dQw4w9WgXcQ", category: "timelapse" },
];

async function getVideos() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("youtube_videos")
      .select("*")
      .order("created_at", { ascending: false });
    return data && data.length > 0 ? data : PLACEHOLDER_VIDEOS;
  } catch {
    return PLACEHOLDER_VIDEOS;
  }
}

export default async function VideosPage() {
  const videos = await getVideos();
  const shorts = videos.filter((v: { category?: string }) => v.category !== "timelapse");
  const timelapses = videos.filter((v: { category?: string }) => v.category === "timelapse");

  return (
    <>
      {/* Hero */}
      <div className="pt-32 pb-12 px-5 md:px-8 text-center">
        <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">
          Trail Reels
        </p>
        <h1 className="font-display text-5xl md:text-7xl text-white mb-4">
          WATCH THE ADVENTURE
        </h1>
        <p className="text-white/55 text-base max-w-xl mx-auto mb-6">
          Short films, trail time-lapses, and adventure reels from our treks
          across India and beyond.
        </p>
        <a
          href="https://youtube.com/@trekriderz"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex btn-accent px-6 py-3 rounded-full font-bold text-sm"
        >
          Subscribe on YouTube →
        </a>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 pb-24 space-y-16">
        {/* Shorts / Main videos */}
        <section>
          <h2 className="font-display text-4xl text-white mb-6">YOUTUBE SHORTS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {shorts.map((v: { id: string; title: string; embed_url: string }) => (
              <div key={v.id} className="glass-card rounded-2xl overflow-hidden">
                <div className="relative aspect-[9/16]">
                  <iframe
                    src={v.embed_url}
                    title={v.title}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <p className="text-white/70 text-xs font-medium line-clamp-2">{v.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Time-lapses — uses section-bg.mp4 */}
        <section className="relative rounded-3xl overflow-hidden">
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/videos/section-bg.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0" style={{ background: "rgba(5,10,5,0.75)" }} />
          <div className="relative z-10 p-8 md:p-12">
            <h2 className="font-display text-4xl text-white mb-6">TIME-LAPSES</h2>
            {timelapses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {timelapses.map((v: { id: string; title: string; embed_url: string }) => (
                  <div key={v.id} className="glass rounded-2xl overflow-hidden">
                    <div className="relative aspect-video">
                      <iframe
                        src={v.embed_url}
                        title={v.title}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-white/70 text-xs font-medium">{v.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass rounded-2xl p-10 text-center text-white/40">
                <p className="text-4xl mb-2">🎬</p>
                <p>Time-lapse videos coming soon</p>
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <div className="glass-accent rounded-2xl p-8 text-center">
          <h2 className="font-display text-4xl text-white mb-2">WANT TO BE IN OUR REELS?</h2>
          <p className="text-white/50 text-sm mb-5">
            Join a TrekRiderz trip and our team will capture your adventure.
            Your photos and memories, professionally documented.
          </p>
          <a
            href="https://wa.me/919999999999?text=Hi%2C%20I%27d%20love%20to%20join%20a%20trek%20and%20be%20featured%20in%20your%20reels!"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block btn-accent px-8 py-3 rounded-full font-bold"
          >
            💬 Join a Trek
          </a>
        </div>
      </div>
    </>
  );
}
