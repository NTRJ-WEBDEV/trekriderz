"use client";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function NoAccessNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "no_access") return null;
  return (
    <p className="text-amber-400 text-xs mb-4 text-center">
      This account doesn't have admin access. Contact an administrator if you believe this is a mistake.
    </p>
  );
}

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); return; }
      router.push("/admin");
      router.refresh();
    } catch (e: any) {
      // Covers a thrown Supabase client (e.g. missing env config) or a
      // failed navigation — without this, either left the button frozen
      // on "Signing in…" forever with no explanation.
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0E27" }}>
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="text-3xl font-black tracking-widest mb-1">
            <span className="text-white">TREK</span><span style={{ color: "#F97316" }}>RIDERZ</span>
          </div>
          <p className="text-white/40 text-xs uppercase tracking-widest">CMS Admin</p>
        </div>
        <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h1 className="text-white text-xl font-bold mb-6">Sign in</h1>
          <Suspense fallback={null}>
            <NoAccessNotice />
          </Suspense>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-2"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="admin@trekriderz.in"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-opacity"
              style={{ background: "#F97316", color: "#0A0E27", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="text-white/20 text-xs text-center mt-6">
            Only authorised team members can access this panel.
          </p>
        </div>
      </div>
    </div>
  );
}
