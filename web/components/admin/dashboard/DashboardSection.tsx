import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReactNode } from "react";
import { ACCENT } from "@/lib/adminTheme";

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  children: ReactNode;
}

export default function DashboardSection({ title, subtitle, viewAllHref, children }: DashboardSectionProps) {
  return (
    <section className="mb-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-lg tracking-tight">{title}</h2>
          {subtitle && <p className="text-white/35 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="flex items-center gap-1 text-xs font-semibold" style={{ color: ACCENT }}>
            View all <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
