"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Reuses `enquiries` (the same table every other form on the site writes
// to) with a distinguishing trip_name marker, rather than a new
// newsletter_subscribers table for a single email field.
export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    const payload = {
      name: "Newsletter Subscriber",
      email,
      trip_name: "Newsletter Signup",
      message: "Subscribed via website newsletter form",
      status: "new",
    };
    const { data, error, status: httpStatus } = await supabase.from("enquiries").insert(payload).select();
    // TEMPORARY — remove once the enquiries insert path is confirmed working.
    console.log("[Newsletter] insert result", { payload, data, error, httpStatus });
    setStatus(error ? "error" : "done");
  };

  return (
    <section className="py-16 px-5 md:px-8">
      <div className="max-w-2xl mx-auto text-center glass-card rounded-3xl p-10">
        <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">Stay in the Loop</p>
        <h2 className="font-display text-3xl md:text-4xl text-white mb-3">GET NEW TRIPS IN YOUR INBOX</h2>
        <p className="text-white/50 text-sm mb-6">New treks, seasonal offers, and travel stories — no spam, unsubscribe anytime.</p>
        {status === "done" ? (
          <p className="text-accent font-semibold">✓ You're subscribed — welcome aboard!</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="form-input text-sm flex-1"
            />
            <button type="submit" disabled={status === "loading"} className="btn-accent px-6 py-3 rounded-full font-bold text-sm disabled:opacity-50">
              {status === "loading" ? "Joining…" : "Subscribe"}
            </button>
          </form>
        )}
        {status === "error" && <p className="text-red-400 text-xs mt-3">Something went wrong — try again.</p>}
      </div>
    </section>
  );
}
