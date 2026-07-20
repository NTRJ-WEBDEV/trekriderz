import Link from "next/link";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}

export default function SectionHeader({ eyebrow, title, href, hrefLabel = "View All →" }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-10">
      <div>
        <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">{eyebrow}</p>
        <h2 className="font-display text-4xl md:text-6xl text-white">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="hidden md:inline-flex btn-ghost px-5 py-2.5 rounded-full text-sm font-medium">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}
