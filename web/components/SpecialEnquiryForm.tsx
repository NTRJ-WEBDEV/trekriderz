"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SpecialEnquiryForm({ type }: { type: "birthday" | "anniversary" }) {
  const label = type === "birthday" ? "Birthday" : "Anniversary";
  const [form, setForm] = useState({
    name: "", whatsapp: "", email: "", group_size: "2",
    preferred_date: "", message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await supabase.from("enquiries").insert({
        trip_name: `${label} Trip`,
        name: form.name,
        email: form.email || null,
        whatsapp: form.whatsapp,
        group_size: parseInt(form.group_size),
        preferred_date: form.preferred_date,
        message: `[${label} Package] ${form.message}`,
        status: "new",
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const waMsg = `Hi TrekRiderz! I want to plan a ${label} trip.%0AName: ${form.name}%0AGroup: ${form.group_size} people%0ADate: ${form.preferred_date}%0A${form.message}`;

  if (status === "done") {
    return (
      <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
        <p className="text-accent text-5xl mb-4">✓</p>
        <h3 className="font-display text-3xl text-white mb-2">ENQUIRY SENT!</h3>
        <p className="text-white/50 text-sm mb-6">
          Our team will WhatsApp you within 24 hours to start planning your
          perfect {label.toLowerCase()} experience.
        </p>
        <a
          href={`https://wa.me/919999999999?text=${waMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent px-6 py-3 rounded-full font-bold text-sm"
        >
          💬 Also WhatsApp Us
        </a>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 md:p-8">
      <h3 className="font-display text-3xl text-white mb-1">BOOK YOUR {label.toUpperCase()}</h3>
      <p className="text-white/50 text-sm mb-6">
        Fill in the details and our team will get back within 24 hours.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          required
          placeholder="Your name *"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className="form-input text-sm"
        />
        <input
          required
          placeholder="WhatsApp number *"
          value={form.whatsapp}
          onChange={(e) => set("whatsapp", e.target.value)}
          className="form-input text-sm"
        />
        <input
          placeholder="Email (optional)"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          className="form-input text-sm"
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-white/40 text-xs mb-1 block">Group size</label>
            <select
              value={form.group_size}
              onChange={(e) => set("group_size", e.target.value)}
              className="form-input text-sm"
            >
              {[1,2,3,4,5,6,8,10,15,20].map((n) => (
                <option key={n} value={n} className="bg-dark-800">
                  {n} {n === 1 ? "person" : "people"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-white/40 text-xs mb-1 block">Preferred date</label>
            <input
              placeholder="e.g. June 15"
              value={form.preferred_date}
              onChange={(e) => set("preferred_date", e.target.value)}
              className="form-input text-sm"
            />
          </div>
        </div>
        <textarea
          placeholder={`Tell us about your ${label.toLowerCase()} trip vision...`}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          rows={4}
          className="form-input text-sm resize-none"
        />
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={status === "loading"}
            className="flex-1 btn-accent py-3 rounded-full font-bold disabled:opacity-40"
          >
            {status === "loading" ? "Sending..." : `Plan ${label} Trip`}
          </button>
          <a
            href={`https://wa.me/919999999999?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 btn-ghost py-3 rounded-full font-bold text-sm text-center"
          >
            💬 WhatsApp
          </a>
        </div>
        {status === "error" && (
          <p className="text-red-400 text-xs text-center">Failed. Please try WhatsApp.</p>
        )}
      </form>
    </div>
  );
}
