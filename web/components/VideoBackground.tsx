"use client";

import { useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

function getVideoSrc(pathname: string): string {
  // Home — tight 9s landscape loop
  if (pathname === "/") return "/videos/hero-bg.mp4";

  // Trips & Destinations — 14s vertical trail footage
  if (pathname.startsWith("/trips") || pathname.startsWith("/destinations"))
    return "/videos/trek-bg.mp4";

  // Expeditions — 12s vertical discovery footage
  if (pathname.startsWith("/expeditions"))
    return "/videos/discover-bg.mp4";

  // Special packages & Custom planner — 10s vertical adventure footage
  if (pathname.startsWith("/special") || pathname.startsWith("/plan"))
    return "/videos/special-bg.mp4";

  // About & Videos pages — 42s vertical nature/scenic footage
  if (pathname.startsWith("/about") || pathname.startsWith("/videos"))
    return "/videos/nature-bg.mp4";

  // Admin & everything else — 40s landscape scenic loop
  return "/videos/section-bg.mp4";
}

export default function VideoBackground() {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = getVideoSrc(pathname);

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
