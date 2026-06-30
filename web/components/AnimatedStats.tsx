"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_STATS = [
  { value: 200, suffix: "+", label: "Trips Organised" },
  { value: 6, suffix: "", label: "Countries" },
  { value: 1500, suffix: "+", label: "Trekkers Guided" },
  { value: 35, suffix: "+", label: "Western Ghats Trails" },
];

interface StatsProps {
  trips?: string;
  countries?: string;
  trekkers?: string;
  trails?: string;
}

function useCounter(target: number, duration = 1800, active: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return count;
}

function StatItem({ value, suffix, label, active }: { value: number; suffix: string; label: string; active: boolean }) {
  const count = useCounter(value, 1800, active);
  return (
    <div className="text-center px-4 md:px-8">
      <div className="font-display text-5xl md:text-6xl text-accent leading-none">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-white/50 text-xs md:text-sm uppercase tracking-widest mt-2 font-medium">
        {label}
      </div>
    </div>
  );
}

export default function AnimatedStats({ trips, countries, trekkers, trails }: StatsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const stats = [
    { value: parseInt(trips || "200") || 200, suffix: "+", label: "Trips Organised" },
    { value: parseInt(countries || "6") || 6, suffix: "", label: "Countries" },
    { value: parseInt(trekkers || "1500") || 1500, suffix: "+", label: "Trekkers Guided" },
    { value: parseInt(trails || "35") || 35, suffix: "+", label: "Western Ghats Trails" },
  ];

  return (
    <div ref={ref} className="relative py-12 my-8 mx-4 md:mx-8">
      <div className="max-w-5xl mx-auto glass-card rounded-2xl py-10 px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x-0 md:divide-x divide-white/5">
          {stats.map((s) => (
            <StatItem key={s.label} {...s} active={active} />
          ))}
        </div>
      </div>
    </div>
  );
}
