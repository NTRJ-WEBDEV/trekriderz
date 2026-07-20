import Link from "next/link";

interface CTASectionProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export default function CTASection({ eyebrow, title, description, primaryLabel, primaryHref, secondaryLabel, secondaryHref }: CTASectionProps) {
  const isExternal = primaryHref.startsWith("http") || primaryHref.startsWith("mailto") || primaryHref.startsWith("tel");
  return (
    <section className="py-20 px-5 md:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <div className="glass-accent rounded-3xl p-10 md:p-16">
          <p className="text-accent text-xs uppercase tracking-widest mb-3 font-semibold">{eyebrow}</p>
          <h2 className="font-display text-4xl md:text-6xl text-white mb-4">{title}</h2>
          <p className="text-white/60 text-base md:text-lg mb-8 leading-relaxed">{description}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isExternal ? (
              <a href={primaryHref} target="_blank" rel="noopener noreferrer" className="btn-accent px-8 py-4 rounded-full font-bold text-base">{primaryLabel}</a>
            ) : (
              <Link href={primaryHref} className="btn-accent px-8 py-4 rounded-full font-bold text-base">{primaryLabel}</Link>
            )}
            {secondaryLabel && secondaryHref && (
              <Link href={secondaryHref} className="btn-ghost px-8 py-4 rounded-full font-bold text-base">{secondaryLabel}</Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
