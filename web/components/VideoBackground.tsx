"use client";

import { useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function VideoBackground() {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Home page uses the tight 9s loop; every other page uses the 40s scenic video
  const src = pathname === "/" ? "/videos/hero-bg.mp4" : "/videos/section-bg.mp4";

  // When the route changes, reload + play the new source
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    v.play().catch(() => {});
  }, [src]);

  return (
    <div className="fixed inset-0 z-0 w-full h-full overflow-hidden pointer-events-none">
      <video
        key={src}
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        poster="/images/hero-fallback.jpg"
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="absolute inset-0" style={{ background: "rgba(5,10,5,0.72)" }} />
    </div>
  );
}
