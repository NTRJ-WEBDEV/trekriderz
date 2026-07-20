"use client";

import { BUSINESS_WA } from "@/lib/constants";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import TripCard, { Trip } from "@/components/TripCard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUDGETS = ["Under ₹5,000", "₹5,000–₹15,000", "₹15,000–₹30,000", "₹30,000–₹60,000", "Above ₹60,000"];
const DEST_TYPES = [
  { id: "mountain", label: "Mountain Trek", emoji: "⛰️" },
  { id: "beach", label: "Beach & Islands", emoji: "🏝️" },
  { id: "heritage", label: "Heritage & Culture", emoji: "🏛️" },
  { id: "jungle", label: "Jungle & Wildlife", emoji: "🌿" },
  { id: "surprise", label: "Surprise Me!", emoji: "🎲" },
];
const COUNTRIES = ["India", "Nepal", "Bhutan", "Philippines", "Indonesia", "Cambodia"];
const FITNESS = ["easy", "moderate", "challenging"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Flexible"];

interface FormData {
  budget: string;
  dest_type: string;
  countries: string[];
  fitness: string;
  group_size: string;
  duration: string;
  preferred_month: string;
  name: string;
  whatsapp: string;
  email: string;
}

const INITIAL: FormData = {
  budget: "", dest_type: "", countries: [], fitness: "moderate",
  group_size: "2", duration: "3-5 days",
  preferred_month: "Flexible", name: "", whatsapp: "", email: "",
};

export default function PlanPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "no_match">("idle");
  const [matches, setMatches] = useState<Trip[]>([]);

  const set = (k: keyof FormData, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCountry = (c: string) => {
    setForm((f) => ({
      ...f,
      countries: f.countries.includes(c)
        ? f.countries.filter((x) => x !== c)
        : [...f.countries, c],
    }));
  };

  const handleSubmit = async () => {
    setStatus("loading");
    try {
      // Save enquiry
      await supabase.from("custom_enquiries").insert({
        budget_range: form.budget,
        destination_type: form.dest_type,
        countries: form.countries,
        fitness_level: form.fitness,
        group_size: parseInt(form.group_size),
        duration: form.duration,
        preferred_month: form.preferred_month,
        name: form.name,
        whatsapp: form.whatsapp,
        email: form.email || null,
        status: "new",
      });

      // Try to find matching trips — no `country` column exists on trips
      // (that concept lives only in the custom_enquiries record just
      // saved above), so matching here is on fitness/difficulty only.
      let query = supabase
        .from("trips")
        .select("id,title,trip_type,destination,start_date,end_date,price_usd,difficulty,is_featured,cover_photo_url")
        .eq("is_public", true);

      if (form.fitness !== "") query = query.eq("difficulty", form.fitness);

      const { data } = await query.limit(3);

      if (data && data.length > 0) {
        setMatches(data as Trip[]);
        setStatus("done");
      } else {
        setStatus("no_match");
      }
    } catch {
      setStatus("no_match");
    }
  };

  const waMsg = `Hi TrekRiderz! I used your Trip Planner:%0ABudget: ${form.budget}%0ADestination: ${form.dest_type} in ${form.countries.join(", ") || "any country"}%0AFitness: ${form.fitness}%0AGroup: ${form.group_size} people%0AMonth: ${form.preferred_month}%0AName: ${form.name}`;

  const STEPS = [
    "Budget", "Destination", "Fitness & Details", "Contact",
  ];

  return (
    <div className="min-h-screen pt-28 pb-20 px-5 md:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-accent text-xs uppercase tracking-widest mb-2 font-semibold">4 Steps</p>
          <h1 className="font-display text-5xl md:text-7xl text-white mb-3">PLAN MY TRIP</h1>
          <p className="text-white/50 text-sm">Tell us your dream — we'll build it for you.</p>
        </div>

        {/* Progress */}
        {status === "idle" || status === "loading" ? (
          <>
            <div className="flex items-center justify-between mb-8">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all ${
                      step > i + 1
                        ? "bg-accent text-dark-900"
                        : step === i + 1
                        ? "bg-accent/20 border border-accent text-accent"
                        : "bg-white/5 border border-white/10 text-white/30"
                    }`}
                  >
                    {step > i + 1 ? "✓" : i + 1}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider ${step === i + 1 ? "text-accent" : "text-white/30"}`}>
                    {s}
                  </span>
                </div>
              ))}
            </div>

            <div className="glass-card rounded-2xl p-6 md:p-8">
              {/* Step 1 — Budget */}
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="font-display text-3xl text-white">WHAT'S YOUR BUDGET?</h2>
                  <p className="text-white/50 text-sm">Per person, excluding flights.</p>
                  <div className="space-y-3">
                    {BUDGETS.map((b) => (
                      <button
                        key={b}
                        onClick={() => set("budget", b)}
                        className={`w-full text-left px-5 py-3 rounded-xl border transition-all text-sm font-medium ${
                          form.budget === b
                            ? "bg-accent/10 border-accent text-accent"
                            : "border-white/10 text-white/70 hover:border-white/20"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={!form.budget}
                    onClick={() => setStep(2)}
                    className="w-full btn-accent py-3 rounded-full font-bold mt-2 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              )}

              {/* Step 2 — Destination */}
              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="font-display text-3xl text-white">DESTINATION TYPE</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {DEST_TYPES.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => set("dest_type", d.id)}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          form.dest_type === d.id
                            ? "bg-accent/10 border-accent"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="text-3xl mb-2">{d.emoji}</div>
                        <div className={`text-xs font-semibold ${form.dest_type === d.id ? "text-accent" : "text-white/70"}`}>
                          {d.label}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-3">Preferred countries (tick all that apply):</p>
                    <div className="flex flex-wrap gap-2">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c}
                          onClick={() => toggleCountry(c)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            form.countries.includes(c)
                              ? "bg-accent text-dark-900"
                              : "glass text-white/60 hover:text-white"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="flex-1 btn-ghost py-3 rounded-full font-bold text-sm">
                      ← Back
                    </button>
                    <button
                      disabled={!form.dest_type}
                      onClick={() => setStep(3)}
                      className="flex-1 btn-accent py-3 rounded-full font-bold disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — Fitness & Details */}
              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="font-display text-3xl text-white">FITNESS & DETAILS</h2>
                  <div>
                    <p className="text-white/50 text-sm mb-3">Physical fitness level:</p>
                    <div className="flex gap-3">
                      {FITNESS.map((f) => (
                        <button
                          key={f}
                          onClick={() => set("fitness", f)}
                          className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${
                            form.fitness === f
                              ? "bg-accent/10 border-accent text-accent"
                              : "border-white/10 text-white/60 hover:border-white/20"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-white/50 text-sm block mb-2">Group size</label>
                    <select
                      value={form.group_size}
                      onChange={(e) => set("group_size", e.target.value)}
                      className="form-input text-sm"
                    >
                      {[1,2,3,4,5,6,7,8,10,12,15,20,25].map((n) => (
                        <option key={n} value={n} className="bg-dark-800">
                          {n} {n === 1 ? "person" : "people"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/50 text-sm block mb-2">Trip duration</label>
                    <select
                      value={form.duration}
                      onChange={(e) => set("duration", e.target.value)}
                      className="form-input text-sm"
                    >
                      {["1-2 days", "3-5 days", "6-8 days", "9-12 days", "13+ days"].map((d) => (
                        <option key={d} value={d} className="bg-dark-800">{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/50 text-sm block mb-2">Preferred month</label>
                    <div className="flex flex-wrap gap-2">
                      {MONTHS.map((m) => (
                        <button
                          key={m}
                          onClick={() => set("preferred_month", m)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            form.preferred_month === m
                              ? "bg-accent text-dark-900"
                              : "glass text-white/60 hover:text-white"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)} className="flex-1 btn-ghost py-3 rounded-full font-bold text-sm">
                      ← Back
                    </button>
                    <button onClick={() => setStep(4)} className="flex-1 btn-accent py-3 rounded-full font-bold">
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4 — Contact */}
              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="font-display text-3xl text-white">YOUR DETAILS</h2>
                  <p className="text-white/50 text-sm">We'll WhatsApp you with matching trips within 24 hours.</p>
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
                  {/* Summary */}
                  <div className="glass rounded-xl p-4 text-xs text-white/50 space-y-1">
                    <p>Budget: <span className="text-white">{form.budget}</span></p>
                    <p>Type: <span className="text-white capitalize">{form.dest_type}</span></p>
                    <p>Countries: <span className="text-white">{form.countries.join(", ") || "Any"}</span></p>
                    <p>Fitness: <span className="text-white capitalize">{form.fitness}</span></p>
                    <p>Group: <span className="text-white">{form.group_size} people</span></p>
                    <p>Duration: <span className="text-white">{form.duration}</span></p>
                    <p>Month: <span className="text-white">{form.preferred_month}</span></p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(3)} className="flex-1 btn-ghost py-3 rounded-full font-bold text-sm">
                      ← Back
                    </button>
                    <button
                      disabled={!form.name || !form.whatsapp || status === "loading"}
                      onClick={handleSubmit}
                      className="flex-1 btn-accent py-3 rounded-full font-bold disabled:opacity-40"
                    >
                      {status === "loading" ? "Finding trips..." : "Find My Trip ✦"}
                    </button>
                  </div>
                  <a
                    href={`https://wa.me/${BUSINESS_WA}?text=${waMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-accent text-xs hover:underline"
                  >
                    Or send via WhatsApp directly →
                  </a>
                </div>
              )}
            </div>
          </>
        ) : status === "done" ? (
          /* Matches */
          <div>
            <div className="text-center mb-8">
              <p className="text-accent text-4xl mb-3">✦</p>
              <h2 className="font-display text-4xl text-white mb-2">WE FOUND MATCHES!</h2>
              <p className="text-white/50 text-sm">
                Our team will also WhatsApp {form.name} at {form.whatsapp} within 24 hours.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              {matches.map((t) => (
                <TripCard key={t.id} trip={t} />
              ))}
            </div>
            <div className="text-center space-y-3">
              <Link href="/trips" className="inline-block btn-accent px-8 py-3 rounded-full font-bold">
                Browse All Trips
              </Link>
              <br />
              <a
                href={`https://wa.me/${BUSINESS_WA}?text=${waMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-white/50 text-sm hover:text-accent"
              >
                💬 Chat on WhatsApp
              </a>
            </div>
          </div>
        ) : (
          /* No match */
          <div className="glass-card rounded-2xl p-10 text-center">
            <p className="text-5xl mb-4">🗺️</p>
            <h2 className="font-display text-4xl text-white mb-2">WE'LL BUILD IT FOR YOU</h2>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              No existing trip matches your exact wishlist — but that's okay! Our team will
              design a custom itinerary just for you and WhatsApp {form.name || "you"} within{" "}
              <strong className="text-accent">24 hours</strong>.
            </p>
            <a
              href={`https://wa.me/${BUSINESS_WA}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block btn-accent px-8 py-3 rounded-full font-bold"
            >
              💬 WhatsApp Us Now
            </a>
            <br />
            <button onClick={() => { setStatus("idle"); setStep(1); setForm(INITIAL); }} className="mt-4 text-white/40 text-xs hover:text-white">
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
