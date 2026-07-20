"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    const payload = { ...form, trip_name: "General Enquiry", status: "new" };
    const { data, error, status: httpStatus } = await supabase.from("enquiries").insert(payload).select();
    // TEMPORARY — remove once the enquiries insert path is confirmed working.
    console.log("[ContactForm] insert result", { payload, data, error, httpStatus });
    setStatus(error ? "error" : "done");
  };

  if (status === "done") {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <p className="text-accent text-4xl mb-3">✓</p>
        <p className="text-white font-semibold">Message sent!</p>
        <p className="text-white/50 text-sm mt-1">We'll get back to you within 24 hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 md:p-8 space-y-3">
      <h2 className="font-display text-2xl text-white mb-2">SEND A MESSAGE</h2>
      <input required placeholder="Your name" value={form.name} onChange={(e) => set("name", e.target.value)} className="form-input text-sm" />
      <input required type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} className="form-input text-sm" />
      <input placeholder="WhatsApp (optional)" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className="form-input text-sm" />
      <textarea required placeholder="How can we help?" rows={5} value={form.message} onChange={(e) => set("message", e.target.value)} className="form-input text-sm resize-none" />
      <button type="submit" disabled={status === "loading"} className="btn-accent w-full py-3 rounded-full font-bold text-sm disabled:opacity-50">
        {status === "loading" ? "Sending…" : "Send Message"}
      </button>
      {status === "error" && <p className="text-red-400 text-xs text-center">Something went wrong — try WhatsApp instead.</p>}
    </form>
  );
}
