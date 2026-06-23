"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/trips", label: "Treks & Tours" },
  { href: "/destinations", label: "Destinations" },
  { href: "/special", label: "Special" },
  { href: "/plan", label: "Plan My Trip" },
  { href: "/videos", label: "Videos" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[rgba(5,10,5,0.92)] backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-baseline gap-0.5 group">
          <span className="font-display text-3xl md:text-4xl text-white group-hover:text-white/90 transition-colors">
            TREK
          </span>
          <span className="font-display text-3xl md:text-4xl text-accent">
            RIDERZ
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={`text-sm font-medium transition-colors hover:text-accent ${
                pathname === l.href ? "text-accent" : "text-white/75"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/plan"
            className="hidden lg:inline-flex btn-accent px-5 py-2 rounded-full text-sm"
          >
            Book Now
          </Link>
          {/* WhatsApp */}
          <a
            href="https://wa.me/919999999999?text=Hi%20TrekRiderz%2C%20I%27m%20interested%20in%20a%20trip!"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-flex items-center gap-1.5 glass px-4 py-2 rounded-full text-sm font-medium hover:border-accent/30 transition-colors"
          >
            <span>📱</span> WhatsApp
          </a>
          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="lg:hidden p-2 text-white/80 hover:text-white"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden glass border-t border-white/10 px-5 pt-4 pb-6 flex flex-col gap-4">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-white/80 hover:text-accent py-1 font-medium transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/plan"
            className="btn-accent px-5 py-3 rounded-full text-center font-bold mt-2"
          >
            Book Now
          </Link>
          <a
            href="https://wa.me/919999999999?text=Hi%20TrekRiderz%2C%20I%27m%20interested%20in%20a%20trip!"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-white/60 hover:text-accent text-sm py-1"
          >
            📱 WhatsApp Us
          </a>
        </div>
      )}
    </nav>
  );
}
