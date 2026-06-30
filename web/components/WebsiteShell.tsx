"use client";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import VideoBackground from "./VideoBackground";
import type { SiteSettings } from "@/lib/site-settings";

interface WebsiteShellProps {
  children: React.ReactNode;
  siteSettings?: Partial<SiteSettings>;
}

export default function WebsiteShell({ children, siteSettings }: WebsiteShellProps) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <>{children}</>;
  return (
    <>
      <VideoBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer settings={siteSettings} />
      </div>
    </>
  );
}
