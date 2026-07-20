"use client";
import { useState } from "react";
import JsonLd from "./JsonLd";
import { faqSchema } from "@/lib/seo";

export interface FAQItem { question: string; answer: string; }

export default function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      <JsonLd data={faqSchema(items)} />
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={i} className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-white font-medium text-sm">{item.question}</span>
              <span className={`text-accent shrink-0 transition-transform ${open ? "rotate-45" : ""}`} aria-hidden="true">+</span>
            </button>
            {open && <p className="px-5 pb-4 text-white/55 text-sm leading-relaxed">{item.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
