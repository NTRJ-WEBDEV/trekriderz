"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const BLANK: any = {
  name: "", type: "trek", country: "India", destination: "", duration_days: 3,
  price_inr: 0, price_usd: 0, max_group_size: 20, difficulty: "moderate",
  inclusions: "", exclusions: "", highlights: "", special_tag: "", available_slots: 20,
  status: "active", whatsapp_link: "", is_featured: false, start_date: "", end_date: "",
};

function Toast({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl"
      style={{ background: type === "success" ? "#10B981" : "#EF4444", color: "#fff" }}>
      {msg}
    </div>
  );
}

function TripsContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [editTrip, setEditTrip] = useState<any>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => setToast({ msg, type });

  const loadTrips = async () => {
    setLoading(true);
    const { data } = await supabase.from("trips").select("*, trip_photos(*)").order("created_at", { ascending: false });
    setTrips(data || []);
    setLoading(false);
  };

  useEffect(() => { loadTrips(); }, []);

  const openNew = () => { setForm({ ...BLANK }); setPhotos([]); setItinerary([]); setEditTrip(null); setShowForm(true); };

  const openEdit = async (trip: any) => {
    setEditTrip(trip);
    setForm({ ...BLANK, ...trip });
    const { data: ph } = await supabase.from("trip_photos").select("*").eq("trip_id", trip.id).order("order_index");
    const { data: it } = await supabase.from("trip_itinerary").select("*").eq("trip_id", trip.id).order("day_number");
    setPhotos(ph || []);
    setItinerary(it || [{ day_number: 1, title: "", description: "" }]);
    setShowForm(true);
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from("trip-photos").upload(path, file);
      if (!error && data) {
        const url = `${SUPABASE_URL}/storage/v1/object/public/trip-photos/${path}`;
        setPhotos(p => [...p, { url, is_cover: p.length === 0, order_index: p.length, _new: true }]);
      }
    }
    setUploading(false);
  };

  const setCover = (idx: number) => setPhotos(p => p.map((ph, i) => ({ ...ph, is_cover: i === idx })));
  const removePhoto = (idx: number) => setPhotos(p => p.filter((_, i) => i !== idx));

  const addItineraryDay = () => setItinerary(it => [...it, { day_number: it.length + 1, title: "", description: "" }]);
  const removeItineraryDay = (idx: number) => setItinerary(it => it.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day_number: i + 1 })));

  const handleSave = async () => {
    if (!form.name || !form.destination) { showToast("Name and destination are required", "error"); return; }
    setUploading(true);
    const coverPhoto = photos.find(p => p.is_cover);
    const payload: any = {
      ...form,
      price_inr: parseInt(form.price_inr) || 0,
      price_usd: parseInt(form.price_usd) || 0,
      max_group_size: parseInt(form.max_group_size) || 20,
      available_slots: parseInt(form.available_slots) || 20,
      duration_days: parseInt(form.duration_days) || 3,
      cover_photo_url: coverPhoto?.url || form.cover_photo_url || null,
      updated_at: new Date().toISOString(),
    };
    delete payload.trip_photos;

    let tripId = editTrip?.id;
    if (tripId) {
      await supabase.from("trips").update(payload).eq("id", tripId);
    } else {
      const { data } = await supabase.from("trips").insert(payload).select().single();
      tripId = data?.id;
    }

    if (tripId) {
      // Save new photos
      const newPhotos = photos.filter(p => p._new);
      if (newPhotos.length > 0) {
        await supabase.from("trip_photos").insert(newPhotos.map((p, i) => ({
          trip_id: tripId, url: p.url, is_cover: p.is_cover, order_index: i,
        })));
      }
      // Update cover status on existing photos
      for (const p of photos.filter(p => !p._new && p.id)) {
        await supabase.from("trip_photos").update({ is_cover: p.is_cover }).eq("id", p.id);
      }
      // Save itinerary
      if (itinerary.some(d => d.title)) {
        await supabase.from("trip_itinerary").delete().eq("trip_id", tripId);
        const validDays = itinerary.filter(d => d.title);
        if (validDays.length > 0) await supabase.from("trip_itinerary").insert(validDays.map(d => ({ ...d, trip_id: tripId })));
      }
    }

    setUploading(false);
    setShowForm(false);
    showToast(editTrip ? "Trip updated!" : "Trip added!");
    loadTrips();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("trips").delete().eq("id", id);
    setDeleteId(null);
    showToast("Trip deleted");
    loadTrips();
  };

  const toggleStatus = async (trip: any) => {
    const next = trip.status === "active" ? "coming_soon" : trip.status === "coming_soon" ? "sold_out" : "active";
    await supabase.from("trips").update({ status: next }).eq("id", trip.id);
    loadTrips();
  };

  const STATUS_COLOR: any = { active: "#10B981", coming_soon: "#F59E0B", sold_out: "#EF4444", draft: "#6B7280", inactive: "#6B7280" };

  const inp = "w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };
  const sel = `${inp} cursor-pointer`;
  const F = (label: string, key: string, type = "text", opts?: string[]) => (
    <div>
      <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">{label}</label>
      {opts ? (
        <select value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          className={sel} style={{ ...inpStyle, color: "#fff" }}>
          {opts.map(o => <option key={o} value={o} style={{ background: "#0A0E27" }}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
          className={inp} style={inpStyle} />
      )}
    </div>
  );
  const TA = (label: string, key: string, rows = 3) => (
    <div>
      <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">{label}</label>
      <textarea value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
        rows={rows} className={`${inp} resize-none`} style={inpStyle} />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Trips Manager</h1>
          <p className="text-white/40 text-sm mt-0.5">{trips.length} trips total</p>
        </div>
        <button onClick={openNew}
          className="px-5 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: "#F97316", color: "#0A0E27" }}>
          + Add Trip
        </button>
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="w-full max-w-3xl rounded-2xl p-6 my-auto" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-bold">{editTrip ? "Edit Trip" : "New Trip"}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {F("Trip Name *", "name")}
                {F("Type", "type", "text", ["trek", "tour", "stay", "special"])}
                {F("Country", "country", "text", ["India", "Nepal", "Bhutan", "Philippines", "Indonesia", "Cambodia"])}
                {F("Destination / Region *", "destination")}
                {F("Duration (days)", "duration_days", "number")}
                {F("Difficulty", "difficulty", "text", ["easy", "moderate", "challenging", "extreme"])}
                {F("Price INR", "price_inr", "number")}
                {F("Price USD (optional)", "price_usd", "number")}
                {F("Max Group Size", "max_group_size", "number")}
                {F("Available Slots", "available_slots", "number")}
                {F("Start Date", "start_date", "date")}
                {F("End Date", "end_date", "date")}
                {F("Special Tag", "special_tag", "text", ["", "Birthday", "Anniversary", "Founder Trip", "Popular", "International", "New"])}
                {F("Status", "status", "text", ["active", "coming_soon", "sold_out", "draft", "inactive"])}
              </div>

              {F("WhatsApp Booking Link", "whatsapp_link")}
              {TA("Inclusions (one per line)", "inclusions", 3)}
              {TA("Exclusions (one per line)", "exclusions", 3)}
              {TA("Highlights (one per line)", "highlights", 3)}

              {/* Featured toggle */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="featured" checked={form.is_featured} onChange={e => setForm((f: any) => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4" style={{ accentColor: "#F97316" }} />
                <label htmlFor="featured" className="text-white/70 text-sm">Show on homepage (Featured)</label>
              </div>

              {/* Photos */}
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-2">Photos</label>
                <div className="flex flex-wrap gap-3 mb-3">
                  {photos.map((ph, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden" style={{ border: ph.is_cover ? "2px solid #F97316" : "1px solid rgba(255,255,255,0.1)" }}>
                      <img src={ph.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.7)" }}>
                        <button onClick={() => setCover(i)} className="text-[10px] px-2 py-1 rounded font-bold" style={{ background: "#F97316", color: "#0A0E27" }}>Cover</button>
                        <button onClick={() => removePhoto(i)} className="text-[10px] px-2 py-1 rounded font-bold" style={{ background: "#EF4444", color: "#fff" }}>Remove</button>
                      </div>
                      {ph.is_cover && <div className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "#F97316", color: "#0A0E27" }}>COVER</div>}
                    </div>
                  ))}
                  <button onClick={() => fileRef.current?.click()}
                    className="w-24 h-24 rounded-xl flex flex-col items-center justify-center text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                    style={{ border: "2px dashed rgba(255,255,255,0.15)" }}>
                    {uploading ? <span className="text-xs">Uploading…</span> : <><span className="text-2xl">+</span><span className="text-[10px] mt-1">Add Photo</span></>}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => handlePhotoUpload(e.target.files)} />
                </div>
              </div>

              {/* Itinerary */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Day-by-Day Itinerary</label>
                  <button onClick={addItineraryDay} className="text-xs px-3 py-1 rounded-lg font-medium" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>+ Add Day</button>
                </div>
                <div className="space-y-3">
                  {itinerary.map((day, i) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-white/50 text-xs font-bold w-16">DAY {day.day_number}</span>
                        <input value={day.title} onChange={e => setItinerary(it => it.map((d, j) => j === i ? { ...d, title: e.target.value } : d))}
                          placeholder="Day title" className={`${inp} flex-1`} style={inpStyle} />
                        <button onClick={() => removeItineraryDay(i)} className="text-white/30 hover:text-red-400 text-sm shrink-0">✕</button>
                      </div>
                      <textarea value={day.description || ""} onChange={e => setItinerary(it => it.map((d, j) => j === i ? { ...d, description: e.target.value } : d))}
                        placeholder="Day description…" rows={2} className={`${inp} resize-none`} style={inpStyle} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={uploading}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-opacity"
                style={{ background: "#F97316", color: "#0A0E27", opacity: uploading ? 0.6 : 1 }}>
                {uploading ? "Saving…" : editTrip ? "Save Changes" : "Add Trip"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full text-center" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-3xl mb-3">🗑️</div>
            <h3 className="text-white font-bold mb-2">Delete trip?</h3>
            <p className="text-white/50 text-sm mb-6">This action cannot be undone. Photos and itinerary will also be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "#EF4444", color: "#fff" }}>Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* TRIPS TABLE */}
      {loading ? (
        <div className="text-center py-20 text-white/30">Loading trips…</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-white/40 text-sm">No trips yet. Add your first trip!</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.03)" }}>
                <th className="text-left px-4 py-3">Trip</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Country</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Price</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Featured</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip, i) => {
                const cover = trip.trip_photos?.find((p: any) => p.is_cover) || trip.trip_photos?.[0];
                return (
                  <tr key={trip.id} className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-lg"
                          style={{ background: cover ? "transparent" : "rgba(255,255,255,0.06)" }}>
                          {cover ? <img src={cover.url} alt="" className="w-full h-full object-cover" /> : "🗺️"}
                        </div>
                        <div>
                          <div className="text-white font-medium">{trip.name}</div>
                          <div className="text-white/40 text-xs">{trip.destination} · {trip.duration_days}D</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-white/60">{trip.country}</td>
                    <td className="px-4 py-3 hidden lg:table-cell font-semibold" style={{ color: "#F97316" }}>
                      ₹{(trip.price_inr || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleStatus(trip)} className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{ background: `${STATUS_COLOR[trip.status] || "#6B7280"}20`, color: STATUS_COLOR[trip.status] || "#6B7280" }}>
                        {trip.status}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-center">
                      {trip.is_featured ? <span style={{ color: "#F97316" }}>★</span> : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => openEdit(trip)} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white/60 hover:text-white transition-colors"
                          style={{ background: "rgba(255,255,255,0.06)" }}>Edit</button>
                        <button onClick={() => setDeleteId(trip.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium hover:text-red-400 transition-colors text-white/40"
                          style={{ background: "rgba(255,255,255,0.04)" }}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TripsPage() {
  return <Suspense><TripsContent /></Suspense>;
}
