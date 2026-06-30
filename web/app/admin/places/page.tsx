"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BLANK = { name: "", state: "", region: "", description: "", best_season: "", difficulty: "easy", altitude_m: 0, cover_image_url: "", is_featured: false, tags: [] as string[] };
const DIFFICULTIES = ["easy", "moderate", "hard", "extreme"];

export default function PlacesPage() {
  const supabase = createClient();
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPlace, setEditPlace] = useState<any>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("places_guide").select("*").order("name");
    setPlaces(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (p: any) => { setEditPlace(p); setForm({ ...BLANK, ...p, tags: p.tags || [] }); setShowForm(true); };
  const openNew = () => { setEditPlace(null); setForm({ ...BLANK }); setTagInput(""); setShowForm(true); };

  const uploadCover = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("place-photos").upload(path, file);
    if (!error) setForm(f => ({ ...f, cover_image_url: `${SUPABASE_URL}/storage/v1/object/public/place-photos/${path}` }));
    setUploading(false);
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) { setForm(f => ({ ...f, tags: [...f.tags, tag] })); }
    setTagInput("");
  };

  const removeTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  const handleSave = async () => {
    if (!form.name) { showToast("Place name is required"); return; }
    const payload = { ...form, altitude_m: Number(form.altitude_m) || null };
    if (editPlace) {
      await supabase.from("places_guide").update(payload).eq("id", editPlace.id);
      showToast("Place updated!");
    } else {
      await supabase.from("places_guide").insert(payload);
      showToast("Place added!");
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("places_guide").delete().eq("id", id);
    setDeleteId(null);
    load();
  };

  const toggleFeatured = async (id: string, is_featured: boolean) => {
    await supabase.from("places_guide").update({ is_featured: !is_featured }).eq("id", id);
    load();
  };

  const filtered = places.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.state?.toLowerCase().includes(search.toLowerCase()));
  const DIFF_COLOR: any = { easy: "#10B981", moderate: "#F59E0B", hard: "#F97316", extreme: "#EF4444" };
  const inp = "w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl" style={{ background: "#10B981", color: "#fff" }}>{toast}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Places Guide</h1>
          <p className="text-white/40 text-sm mt-0.5">{places.length} destinations documented</p>
        </div>
        <button onClick={openNew} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#F97316", color: "#0A0E27" }}>
          + Add Place
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search places…"
        className="w-full max-w-sm rounded-xl px-4 py-2.5 text-white text-sm outline-none mb-5"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-2xl rounded-2xl p-6 my-auto" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-bold">{editPlace ? "Edit Place" : "Add Place"}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Place Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} style={inpStyle} placeholder="e.g. Valley of Flowers" />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">State</label>
                  <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inp} style={inpStyle} placeholder="e.g. Uttarakhand" />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Region</label>
                  <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className={inp} style={inpStyle} placeholder="e.g. Garhwal Himalayas" />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className={inp} style={{ ...inpStyle, color: "#fff" }}>
                    {DIFFICULTIES.map(d => <option key={d} value={d} style={{ background: "#0A0E27" }}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Altitude (m)</label>
                  <input type="number" value={form.altitude_m} onChange={e => setForm(f => ({ ...f, altitude_m: parseInt(e.target.value) || 0 }))} className={inp} style={inpStyle} />
                </div>
                <div className="col-span-2">
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Best Season</label>
                  <input value={form.best_season} onChange={e => setForm(f => ({ ...f, best_season: e.target.value }))} className={inp} style={inpStyle} placeholder="e.g. June to September" />
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={5} className={`${inp} resize-none`} style={inpStyle} placeholder="Detailed guide about this place, what to expect, highlights…" />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-white">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Add tag (press Enter)" className="flex-1 rounded-xl px-4 py-2 text-white text-sm outline-none" style={inpStyle} />
                  <button onClick={addTag} className="px-3 py-2 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Add</button>
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Cover Image</label>
                {form.cover_image_url && <img src={form.cover_image_url} alt="" className="w-full h-40 object-cover rounded-xl mb-2" />}
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="text-xs px-4 py-2 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                  {uploading ? "Uploading…" : "Upload Cover"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && uploadCover(e.target.files[0])} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="feat" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4" style={{ accentColor: "#F97316" }} />
                <label htmlFor="feat" className="text-white/70 text-sm">Feature on homepage</label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "#F97316", color: "#0A0E27" }}>
                {editPlace ? "Save Changes" : "Add Place"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Places list */}
      {loading ? <div className="text-center py-20 text-white/30">Loading…</div> : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">No places found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {p.cover_image_url && <img src={p.cover_image_url} alt={p.name} className="w-full object-cover" style={{ height: 120 }} />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-white font-semibold">{p.name}</div>
                    <div className="text-white/40 text-xs mt-0.5">{p.state}{p.region ? ` · ${p.region}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.is_featured && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>★</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize" style={{ background: `${DIFF_COLOR[p.difficulty]}20`, color: DIFF_COLOR[p.difficulty] }}>
                      {p.difficulty}
                    </span>
                  </div>
                </div>
                {p.altitude_m > 0 && <div className="text-white/30 text-xs mt-1">{p.altitude_m.toLocaleString()}m altitude</div>}
                {p.best_season && <div className="text-white/30 text-xs">Best: {p.best_season}</div>}
                {p.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.tags.map((t: string) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded text-white/40" style={{ background: "rgba(255,255,255,0.06)" }}>{t}</span>)}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(p)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Edit</button>
                  <button onClick={() => toggleFeatured(p.id, p.is_featured)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>
                    {p.is_featured ? "Unfeature" : "Feature"}
                  </button>
                  <button onClick={() => setDeleteId(p.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium ml-auto" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full text-center" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-3xl mb-3">📍</div>
            <h3 className="text-white font-bold mb-2">Delete place?</h3>
            <p className="text-white/50 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId!)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "#EF4444", color: "#fff" }}>Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
