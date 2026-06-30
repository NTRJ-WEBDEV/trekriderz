"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const BLANK = { title: "", youtube_url: "", description: "", category: "trek", order_index: 0 };
const CATEGORIES = ["trek", "destination", "tips", "testimonial", "brand"];

export default function VideosPage() {
  const supabase = createClient();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editVideo, setEditVideo] = useState<any>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("youtube_videos").select("*").order("order_index", { ascending: true });
    setVideos(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (v: any) => { setEditVideo(v); setForm({ ...BLANK, ...v }); setShowForm(true); };
  const openNew = () => { setEditVideo(null); setForm({ ...BLANK, order_index: videos.length }); setShowForm(true); };

  const getYouTubeId = (url: string) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const getThumbnail = (url: string) => {
    const id = getYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
  };

  const handleSave = async () => {
    if (!form.title || !form.youtube_url) { showToast("Title and URL are required"); return; }
    if (!getYouTubeId(form.youtube_url)) { showToast("Invalid YouTube URL"); return; }
    const payload = { ...form };
    if (editVideo) {
      await supabase.from("youtube_videos").update(payload).eq("id", editVideo.id);
      showToast("Video updated!");
    } else {
      await supabase.from("youtube_videos").insert(payload);
      showToast("Video added!");
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("youtube_videos").delete().eq("id", id);
    setDeleteId(null);
    load();
  };

  const moveOrder = async (id: string, dir: -1 | 1) => {
    const idx = videos.findIndex(v => v.id === id);
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === videos.length - 1)) return;
    const swap = videos[idx + dir];
    await Promise.all([
      supabase.from("youtube_videos").update({ order_index: videos[idx + dir].order_index }).eq("id", id),
      supabase.from("youtube_videos").update({ order_index: videos[idx].order_index }).eq("id", swap.id),
    ]);
    load();
  };

  const inp = "w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl" style={{ background: "#10B981", color: "#fff" }}>{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">YouTube Videos</h1>
          <p className="text-white/40 text-sm mt-0.5">{videos.length} videos · drag to reorder</p>
        </div>
        <button onClick={openNew} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#F97316", color: "#0A0E27" }}>
          + Add Video
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-bold">{editVideo ? "Edit Video" : "Add Video"}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">YouTube URL *</label>
                <input value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
                  className={inp} style={inpStyle} placeholder="https://youtube.com/watch?v=..." />
              </div>
              {form.youtube_url && getThumbnail(form.youtube_url) && (
                <img src={getThumbnail(form.youtube_url)!} alt="thumbnail" className="w-full rounded-xl" style={{ height: 160, objectFit: "cover" }} />
              )}
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inp} style={inpStyle} placeholder="Video title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className={inp} style={{ ...inpStyle, color: "#fff" }}>
                    {CATEGORIES.map(c => <option key={c} value={c} style={{ background: "#0A0E27" }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Display Order</label>
                  <input type="number" value={form.order_index} onChange={e => setForm(f => ({ ...f, order_index: parseInt(e.target.value) || 0 }))}
                    className={inp} style={inpStyle} min={0} />
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className={`${inp} resize-none`} style={inpStyle} placeholder="Short description (optional)" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "#F97316", color: "#0A0E27" }}>
                {editVideo ? "Save Changes" : "Add Video"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Videos grid */}
      {loading ? <div className="text-center py-20 text-white/30">Loading…</div> : videos.length === 0 ? (
        <div className="text-center py-16 text-white/30">No videos yet. Add your first YouTube video.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v, idx) => {
            const thumb = getThumbnail(v.youtube_url);
            return (
              <div key={v.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="relative">
                  {thumb ? (
                    <img src={thumb} alt={v.title} className="w-full" style={{ height: 140, objectFit: "cover" }} />
                  ) : (
                    <div className="w-full flex items-center justify-center" style={{ height: 140, background: "rgba(255,255,255,0.05)" }}>
                      <span className="text-4xl">🎬</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <a href={v.youtube_url} target="_blank" rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl" style={{ background: "rgba(0,0,0,0.7)" }}>
                      <span className="text-white text-lg ml-0.5">▶</span>
                    </a>
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase" style={{ background: "rgba(0,0,0,0.7)", color: "#F97316" }}>
                      #{idx + 1} {v.category}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-white text-sm font-semibold line-clamp-2">{v.title}</div>
                  {v.description && <div className="text-white/40 text-xs mt-1 line-clamp-2">{v.description}</div>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => moveOrder(v.id, -1)} disabled={idx === 0}
                      className="px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.06)", color: idx === 0 ? "rgba(255,255,255,0.2)" : "#fff" }}>↑</button>
                    <button onClick={() => moveOrder(v.id, 1)} disabled={idx === videos.length - 1}
                      className="px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.06)", color: idx === videos.length - 1 ? "rgba(255,255,255,0.2)" : "#fff" }}>↓</button>
                    <button onClick={() => openEdit(v)} className="px-3 py-1 rounded text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Edit</button>
                    <button onClick={() => setDeleteId(v.id)} className="px-3 py-1 rounded text-xs font-medium ml-auto" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full text-center" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-3xl mb-3">🎬</div>
            <h3 className="text-white font-bold mb-2">Delete video?</h3>
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
