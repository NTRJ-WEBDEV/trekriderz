"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Compass, UserPlus, Home, BellPlus, Siren } from "lucide-react";
import { ACCENT } from "@/lib/adminTheme";

interface QuickCreate {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission: string | null;
}

function greeting(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function MissionControlHeader({
  name, permissions,
}: {
  name: string;
  permissions: string[];
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const quickCreates: QuickCreate[] = [
    { label: "New Trip", href: "/admin/expeditions", icon: <Compass size={15} />, permission: "expeditions.manage" },
    { label: "New Guide", href: "/admin/guides", icon: <UserPlus size={15} />, permission: "guides.approve" },
    { label: "Add Homestay", href: "/admin/homestays", icon: <Home size={15} />, permission: "homestays.approve" },
    { label: "Send Notification", href: "/admin/notifications", icon: <BellPlus size={15} />, permission: null },
    { label: "Emergency Alert", href: "/admin/sos", icon: <Siren size={15} />, permission: "sos.manage" },
  ].filter((a) => a.permission === null || permissions.includes(a.permission));

  return (
    <div className="mb-10 flex items-start justify-between flex-wrap gap-6">
      <div>
        <div className="text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: ACCENT }}>
          TrekRiderz Mission Control
        </div>
        <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight mb-2">
          {greeting(now?.getHours() ?? 8)}, {name}
        </h1>
        <p className="text-white/40 text-sm">
          {now?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) ?? ""}
          {now && " · "}
          {now?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) ?? ""}
          {" · "}Today's Overview
        </p>
      </div>

      {quickCreates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickCreates.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {a.icon}
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
