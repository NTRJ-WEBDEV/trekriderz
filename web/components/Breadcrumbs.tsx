import Link from "next/link";
import JsonLd from "./JsonLd";
import { breadcrumbSchema } from "@/lib/seo";

interface Crumb { name: string; path: string; }

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema(items)} />
      <nav aria-label="Breadcrumb" className="text-xs text-white/40 mb-4 flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <span key={item.path} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === items.length - 1 ? (
              <span className="text-white/60" aria-current="page">{item.name}</span>
            ) : (
              <Link href={item.path} className="hover:text-accent transition-colors">{item.name}</Link>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
