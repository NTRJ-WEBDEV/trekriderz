import Link from "next/link";

const EXPLORE_LINKS = [
  ["Treks & Tours", "/trips"],
  ["International Tours", "/trips?country=Nepal"],
  ["Special Packages", "/special"],
  ["Plan My Custom Trip", "/plan"],
  ["Watch Videos", "/videos"],
  ["About TrekRiderz", "/about"],
];

const DESTINATIONS = [
  ["India — Western Ghats", "/trips?country=India"],
  ["Nepal", "/trips?country=Nepal"],
  ["Bhutan", "/trips?country=Bhutan"],
  ["Philippines", "/trips?country=Philippines"],
  ["Indonesia", "/trips?country=Indonesia"],
  ["Cambodia", "/trips?country=Cambodia"],
];

export default function Footer() {
  return (
    <footer className="relative glass border-t border-white/5">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-baseline gap-0.5 mb-3">
              <span className="font-display text-4xl text-white">TREK</span>
              <span className="font-display text-4xl text-accent">RIDERZ</span>
            </div>
            <p className="text-white/50 text-sm mb-5 leading-relaxed">
              Trek. Travel. Connect.
              <br />
              India's community-led trekking platform — Western Ghats to the
              Himalayas and beyond.
            </p>
            <a
              href="https://wa.me/919999999999?text=Hi%20TrekRiderz!"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 btn-accent px-5 py-2.5 rounded-full text-sm"
            >
              <span>💬</span> WhatsApp Us
            </a>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-accent font-bold text-xs uppercase tracking-widest mb-4">
              Explore
            </h4>
            <div className="flex flex-col gap-2.5">
              {EXPLORE_LINKS.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-white/55 text-sm hover:text-white transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Destinations */}
          <div>
            <h4 className="text-accent font-bold text-xs uppercase tracking-widest mb-4">
              Destinations
            </h4>
            <div className="flex flex-col gap-2.5">
              {DESTINATIONS.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-white/55 text-sm hover:text-white transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-accent font-bold text-xs uppercase tracking-widest mb-4">
              Contact
            </h4>
            <div className="flex flex-col gap-3 text-sm text-white/55">
              <a
                href="https://wa.me/919999999999"
                className="hover:text-accent transition-colors"
              >
                📱 +91 99999 99999
              </a>
              <a
                href="mailto:hello@trekriderz.com"
                className="hover:text-accent transition-colors"
              >
                ✉️ hello@trekriderz.com
              </a>
              <span>📍 Karnataka, India</span>
              <div className="mt-3 pt-3 border-t border-white/10">
                <a
                  href="https://instagram.com/trekriderz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors block mb-1"
                >
                  Instagram
                </a>
                <a
                  href="https://youtube.com/@trekriderz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors block"
                >
                  YouTube
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <p>© 2026 TrekRiderz · NTRJ WEBDEV PVT LTD · All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-white/60 transition-colors">
              About
            </Link>
            <a href="#" className="hover:text-white/60 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white/60 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
