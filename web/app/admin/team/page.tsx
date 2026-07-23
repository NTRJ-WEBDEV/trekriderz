"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function TeamPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ id: string; key: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "moderator", name: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    const [m, i, r] = await Promise.all([
      // role_id, not the legacy `role` text column — profiles.role isn't
      // read by middleware.ts/getAdminSession() anymore, only role_id is.
      supabase.from("profiles").select("*, roles:role_id(id,key,name)").order("created_at"),
      supabase.from("admin_invites").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("id,key,name").order("name"),
    ]);
    setMembers(m.data || []);
    setInvites(i.data?.filter(inv => !inv.accepted_at) || []);
    setRoles(r.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!inviteForm.email) { showToast("Email is required"); return; }
    const token = crypto.randomUUID();
    const { error } = await supabase.from("admin_invites").insert({
      email: inviteForm.email,
      role: inviteForm.role,
      name: inviteForm.name,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) { showToast("Error: " + error.message); return; }
    showToast("Invite created! Share the signup link with them.");
    setShowInvite(false);
    setInviteForm({ email: "", role: "moderator", name: "" });
    load();
  };

  const changeRole = async (id: string, roleId: string) => {
    await supabase.from("profiles").update({ role_id: roleId || null }).eq("id", id);
    load();
    showToast("Role updated!");
  };

  const removeMember = async (id: string) => {
    await supabase.from("profiles").delete().eq("id", id);
    setDeleteId(null);
    load();
  };

  const cancelInvite = async (id: string) => {
    await supabase.from("admin_invites").delete().eq("id", id);
    load();
  };

  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/admin/accept-invite?token=${token}`);
    showToast("Invite link copied!");
  };

  const inp = "w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl" style={{ background: "#10B981", color: "#fff" }}>{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Team Manager</h1>
          <p className="text-white/40 text-sm mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""} · {invites.length} pending invite{invites.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#F97316", color: "#0A0E27" }}>
          + Invite Member
        </button>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-bold">Invite Team Member</h2>
              <button onClick={() => setShowInvite(false)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Name</label>
                <input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                  className={inp} style={inpStyle} placeholder="Team member name" />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Email *</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className={inp} style={inpStyle} placeholder="colleague@example.com" />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className={inp} style={{ ...inpStyle, color: "#fff" }}>
                  <option value="moderator" style={{ background: "#0A0E27" }}>Moderator — stories, places, trip content</option>
                  <option value="super_admin" style={{ background: "#0A0E27" }}>Super Admin — full access</option>
                </select>
              </div>
              <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(249,115,22,0.08)", color: "rgba(255,255,255,0.5)" }}>
                An invite record will be created. Share the generated link with them — they sign up at /admin/login with their email.
                The trigger auto-assigns their role when they first sign up if they match an invite.
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={sendInvite} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "#F97316", color: "#0A0E27" }}>
                Create Invite
              </button>
              <button onClick={() => setShowInvite(false)} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-20 text-white/30">Loading…</div> : (
        <div className="space-y-6">
          {/* Active members */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-white font-semibold mb-4">Active Members</h2>
            {members.length === 0 ? (
              <div className="text-center py-8 text-white/30">No members yet</div>
            ) : (
              <div className="space-y-3">
                {members.map(m => {
                  const isSuperAdmin = m.roles?.key === "super_admin";
                  return (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: isSuperAdmin ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.08)", color: isSuperAdmin ? "#F97316" : "#fff" }}>
                      {(m.name || m.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{m.name || "—"}</div>
                      <div className="text-white/40 text-xs truncate">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select value={m.role_id || ""} onChange={e => changeRole(m.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg outline-none"
                        style={{ background: "rgba(255,255,255,0.08)", color: isSuperAdmin ? "#F97316" : "rgba(255,255,255,0.6)", border: "none" }}>
                        <option value="" style={{ background: "#0A0E27" }}>No access</option>
                        {roles.map(r => <option key={r.id} value={r.id} style={{ background: "#0A0E27" }}>{r.name}</option>)}
                      </select>
                      <button onClick={() => setDeleteId(m.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-white font-semibold mb-4">Pending Invites</h2>
              <div className="space-y-3">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>
                      {(inv.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{inv.email}</div>
                      <div className="text-white/40 text-xs">{inv.role} · expires {new Date(inv.expires_at).toLocaleDateString("en-IN")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyInviteLink(inv.token)} className="text-xs px-3 py-1 rounded-lg font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#6366F1" }}>
                        Copy Link
                      </button>
                      <button onClick={() => cancelInvite(inv.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permissions reference */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 className="text-white/60 text-sm font-semibold mb-3">Role Permissions</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-semibold mb-2" style={{ color: "#F97316" }}>Super Admin</div>
                {["All Trips (full CRUD)", "All Enquiries", "All Stories (approve/reject)", "YouTube Videos", "Vehicle Rentals", "Places Guide", "Site Settings", "Team Manager"].map(p => (
                  <div key={p} className="text-white/40 flex items-center gap-1.5 mb-1"><span style={{ color: "#10B981" }}>✓</span>{p}</div>
                ))}
              </div>
              <div>
                <div className="font-semibold mb-2 text-white/50">Moderator</div>
                {["Own Stories (write)", "Submit for approval", "Places Guide (suggest)", "Trip content (read)"].map(p => (
                  <div key={p} className="text-white/40 flex items-center gap-1.5 mb-1"><span style={{ color: "#10B981" }}>✓</span>{p}</div>
                ))}
                {["Trips CRUD", "Enquiries", "Videos", "Vehicles", "Settings", "Team"].map(p => (
                  <div key={p} className="text-white/25 flex items-center gap-1.5 mb-1"><span>✕</span>{p}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full text-center" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-3xl mb-3">👤</div>
            <h3 className="text-white font-bold mb-2">Remove team member?</h3>
            <p className="text-white/50 text-sm mb-6">They will lose all admin access immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => removeMember(deleteId!)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "#EF4444", color: "#fff" }}>Remove</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
