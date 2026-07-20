"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/services/AuditService";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BLANK = { title: "", destination: "", body: "", cover_image_url: "", status: "draft", is_featured: false };

export default function StoriesPage() {
  const supabase = createClient();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editStory, setEditStory] = useState<any>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("stories").select("*, author:author_id(email, name)").order("created_at", { ascending: false });
    setStories(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (story: any) => { setEditStory(story); setForm({ ...BLANK, ...story }); setShowForm(true); };
  const openNew = () => { setEditStory(null); setForm({ ...BLANK }); setShowForm(true); };

  const uploadCover = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("story-photos").upload(path, file);
    if (!error) setForm(f => ({ ...f, cover_image_url: `${SUPABASE_URL}/storage/v1/object/public/story-photos/${path}` }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title) { showToast("Title is required"); return; }
    const payload = { ...form, updated_at: new Date().toISOString() };
    if (editStory) {
      await supabase.from("stories").update(payload).eq("id", editStory.id);
      showToast("Story updated!");
    } else {
      await supabase.from("stories").insert(payload);
      showToast("Story created!");
    }
    setShowForm(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("stories").update({ status }).eq("id", id);
    await logAdminAction({ action: status === "approved" ? "story.approved" : "story.rejected", entityType: "story", entityId: id, newValue: { status } });
    load();
  };

  const toggleFeatured = async (id: string, is_featured: boolean) => {
    await supabase.from("stories").update({ is_featured: !is_featured }).eq("id", id);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("stories").delete().eq("id", id);
    setDeleteId(null);
    load();
  };

  const filtered = stories.filter(s => filter === "all" || s.status === filter);
  const STATUS_COLOR: any = { draft: "#6B7280", submitted: "#F59E0B", approved: "#10B981", rejected: "#EF4444" };
  const inp = "w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl" style={{ background: "#10B981", color: "#fff" }}>{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Stories Manager</h1>
          <p className="text-white/40 text-sm mt-0.5">{stories.filter(s => s.status === "submitted").length} awaiting approval</p>
        </div>
        <button onClick={openNew} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#F97316", color: "#0A0E27" }}>
          + New Story
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {["all", "draft", "submitted", "approved", "rejected"].map(s => (
          <button key={s} onClick={() => setFilter(s)} className="px-3 py-1.5 rounded-full text-xs font-semibold capitalize"
            style={{ background: filter === s ? "#F97316" : "rgba(255,255,255,0.06)", color: filter === s ? "#0A0E27" : "rgba(255,255,255,0.5)" }}>
            {s} ({s === "all" ? stories.length : stories.filter(x => x.status === s).length})
          </button>
        ))}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-3xl rounded-2xl p-6 my-auto" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-bold">{editStory ? "Edit Story" : "New Story"}</h2>
              <div className="flex gap-3">
                <button onClick={() => setPreview(!preview)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                  {preview ? "Edit" : "Preview"}
                </button>
                <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white text-xl">✕</button>
              </div>
            </div>

            {preview ? (
              <div className="prose prose-invert max-w-none">
                {form.cover_image_url && <img src={form.cover_image_url} alt="" className="w-full h-56 object-cover rounded-xl mb-4" />}
                <h2 className="text-white text-2xl font-bold">{form.title || "Untitled"}</h2>
                <p className="text-white/50 text-sm">{form.destination}</p>
                <pre className="text-white/80 text-sm whitespace-pre-wrap mt-4 font-sans">{form.body}</pre>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Title *</label>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} style={inpStyle} placeholder="Story title" />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Destination</label>
                    <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} className={inp} style={inpStyle} placeholder="e.g. Coorg, Karnataka" />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp} style={{ ...inpStyle, color: "#fff" }}>
                      {["draft", "submitted", "approved", "rejected"].map(s => <option key={s} value={s} style={{ background: "#0A0E27" }}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Cover Image</label>
                  {form.cover_image_url && <img src={form.cover_image_url} alt="" className="w-full h-40 object-cover rounded-xl mb-2" />}
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="text-xs px-4 py-2 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                    {uploading ? "Uploading…" : "Upload Cover Photo"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Story Body (markdown supported)</label>
                  <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    rows={14} className={`${inp} resize-none font-mono text-xs`} style={inpStyle}
                    placeholder="Write your story here... Markdown is supported.&#10;&#10;# Heading&#10;**Bold**, *italic*, [link](url)" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="feat" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4" style={{ accentColor: "#F97316" }} />
                  <label htmlFor="feat" className="text-white/70 text-sm">Feature on homepage</label>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "#F97316", color: "#0A0E27" }}>
                {editStory ? "Save Changes" : "Create Story"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Stories list */}
      {loading ? <div className="text-center py-20 text-white/30">Loading…</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? <div className="text-center py-16 text-white/30">No stories found</div> : filtered.map(s => (
            <div key={s.id} className="rounded-2xl p-5 flex gap-4 items-start" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.status === "submitted" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}` }}>
              {s.cover_image_url && <img src={s.cover_image_url} alt="" className="w-20 h-16 object-cover rounded-xl shrink-0 hidden sm:block" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold">{s.title}</div>
                    <div className="text-white/40 text-xs mt-0.5">{s.destination} · {s.author?.email || "Admin"}</div>
                    <div className="text-white/30 text-xs mt-1 line-clamp-2">{s.body?.slice(0, 120)}…</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.is_featured && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>★ Featured</span>}
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold capitalize" style={{ background: `${STATUS_COLOR[s.status]}20`, color: STATUS_COLOR[s.status] }}>{s.status}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => openEdit(s)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Edit</button>
                  {s.status === "submitted" && <>
                    <button onClick={() => updateStatus(s.id, "approved")} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>Approve</button>
                    <button onClick={() => updateStatus(s.id, "rejected")} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>Reject</button>
                  </>}
                  <button onClick={() => toggleFeatured(s.id, s.is_featured)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>
                    {s.is_featured ? "Unfeature" : "Feature"}
                  </button>
                  <button onClick={() => setDeleteId(s.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium ml-auto" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full text-center" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-3xl mb-3">📖</div>
            <h3 className="text-white font-bold mb-2">Delete story?</h3>
            <p className="text-white/50 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "#EF4444", color: "#fff" }}>Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
