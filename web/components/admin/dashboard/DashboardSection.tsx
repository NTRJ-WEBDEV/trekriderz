import Link from "next/link";
import { ReactNode } from "react";

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  children: ReactNode;
}

export default function DashboardSection({ title, subtitle, viewAllHref, children }: DashboardSectionProps) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-white font-semibold text-base">{title}</h2>
          {subtitle && <p className="text-white/30 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-xs font-medium" style={{ color: "#F97316" }}>
            View all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
