"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TripEnquiryForm({
  tripId,
  tripName,
}: {
  tripId: string;
  tripName: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    group_size: "2",
    preferred_date: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await supabase.from("enquiries").insert({
        trip_id: tripId,
        trip_name: tripName,
        ...form,
        group_size: parseInt(form.group_size),
        status: "new",
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const waMsg = `Hi, I'm interested in *${tripName}*%0AGroup size: ${form.group_size || "?"}%0APreferred date: ${form.preferred_date || "flexible"}%0A${form.message}`;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost w-full py-3 rounded-full font-bold text-sm text-center"
      >
        Send Enquiry
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-accent text-sm font-semibold">Enquiry Form</p>
      {status === "done" ? (
        <div className="text-center py-6 text-white/70 text-sm">
          <p className="text-accent text-2xl mb-2">✓</p>
          <p className="font-semibold text-white">Enquiry sent!</p>
          <p className="text-xs mt-1 text-white/50">We'll WhatsApp you within 24 hours.</p>
          <a
            href={`https://wa.me/919999999999?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block btn-accent px-5 py-2 rounded-full text-xs font-bold"
          >
            Chat on WhatsApp too
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            required
            placeholder="Your name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="form-input text-sm"
          />
          <input
            required
            placeholder="WhatsApp number"
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
          <div className="flex gap-2">
            <select
              value={form.group_size}
              onChange={(e) => set("group_size", e.target.value)}
              className="form-input text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((n) => (
                <option key={n} value={n} className="bg-dark-800">
                  {n} {n === 1 ? "person" : "people"}
                </option>
              ))}
            </select>
            <input
              placeholder="Preferred date"
              value={form.preferred_date}
              onChange={(e) => set("preferred_date", e.target.value)}
              className="form-input text-sm"
            />
          </div>
          <textarea
            placeholder="Message (optional)"
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            rows={3}
            className="form-input text-sm resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex-1 btn-accent py-2.5 rounded-full text-xs font-bold"
            >
              {status === "loading" ? "Sending..." : "Send Enquiry"}
            </button>
            <a
              href={`https://wa.me/919999999999?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 btn-ghost py-2.5 rounded-full text-xs font-bold text-center"
            >
              📱 WhatsApp
            </a>
          </div>
          {status === "error" && (
            <p className="text-red-400 text-xs text-center">
              Failed to send. Try WhatsApp directly.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
