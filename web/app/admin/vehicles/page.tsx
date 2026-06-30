"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BLANK = { name: "", type: "bike", capacity: 1, price_per_day: 0, location: "", description: "", is_available: true };
const TYPES = ["bike", "suv", "van", "tempo", "car", "bicycle"];

export default function VehiclesPage() {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<any>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cms_vehicles").select("*, cms_vehicle_photos(url, is_primary)").order("created_at", { ascending: false });
    setVehicles(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (v: any) => {
    setEditVehicle(v);
    setForm({ ...BLANK, ...v });
    setPhotos(v.cms_vehicle_photos?.map((p: any) => p.url) || []);
    setShowForm(true);
  };
  const openNew = () => { setEditVehicle(null); setForm({ ...BLANK }); setPhotos([]); setShowForm(true); };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("vehicle-photos").upload(path, file);
    if (!error) setPhotos(prev => [...prev, `${SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${path}`]);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name) { showToast("Vehicle name is required"); return; }
    const payload = { ...form, price_per_day: Number(form.price_per_day), capacity: Number(form.capacity) };
    let vehicleId = editVehicle?.id;
    if (editVehicle) {
      await supabase.from("cms_vehicles").update(payload).eq("id", editVehicle.id);
    } else {
      const { data } = await supabase.from("cms_vehicles").insert(payload).select("id").single();
      vehicleId = data?.id;
    }
    if (vehicleId && photos.length > 0) {
      await supabase.from("cms_vehicle_photos").delete().eq("vehicle_id", vehicleId);
      await supabase.from("cms_vehicle_photos").insert(photos.map((url, i) => ({ vehicle_id: vehicleId, url, is_primary: i === 0 })));
    }
    showToast(editVehicle ? "Vehicle updated!" : "Vehicle added!");
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cms_vehicle_photos").delete().eq("vehicle_id", id);
    await supabase.from("cms_vehicles").delete().eq("id", id);
    setDeleteId(null);
    load();
  };

  const toggleAvailability = async (id: string, is_available: boolean) => {
    await supabase.from("cms_vehicles").update({ is_available: !is_available }).eq("id", id);
    load();
  };

  const TYPE_ICON: any = { bike: "🏍️", suv: "🚙", van: "🚐", tempo: "🚌", car: "🚗", bicycle: "🚲" };
  const inp = "w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl" style={{ background: "#10B981", color: "#fff" }}>{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Vehicle Rentals</h1>
          <p className="text-white/40 text-sm mt-0.5">{vehicles.filter(v => v.is_available).length} available · {vehicles.filter(v => !v.is_available).length} unavailable</p>
        </div>
        <button onClick={openNew} className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#F97316", color: "#0A0E27" }}>
          + Add Vehicle
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-xl rounded-2xl p-6 my-auto" style={{ background: "#0D1226", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-bold">{editVehicle ? "Edit Vehicle" : "Add Vehicle"}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Vehicle Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} style={inpStyle} placeholder="e.g. Royal Enfield Himalayan" />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp} style={{ ...inpStyle, color: "#fff" }}>
                    {TYPES.map(t => <option key={t} value={t} style={{ background: "#0A0E27" }}>{TYPE_ICON[t]} {t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Capacity (persons)</label>
                  <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))} min={1} className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Price / day (₹)</label>
                  <input type="number" value={form.price_per_day} onChange={e => setForm(f => ({ ...f, price_per_day: parseFloat(e.target.value) || 0 }))} min={0} className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inp} style={inpStyle} placeholder="e.g. Manali" />
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className={`${inp} resize-none`} style={inpStyle} placeholder="Features, included accessories, etc." />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider block mb-1">Photos</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {photos.map((url, i) => (
                    <div key={url} className="relative">
                      <img src={url} alt="" className="w-20 h-16 object-cover rounded-lg" />
                      {i === 0 && <span className="absolute top-1 left-1 text-[9px] px-1 rounded font-bold" style={{ background: "#F97316", color: "#fff" }}>Primary</span>}
                      <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center"
                        style={{ background: "#EF4444", color: "#fff" }}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="text-xs px-4 py-2 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                  {uploading ? "Uploading…" : "Add Photo"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="avail" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} className="w-4 h-4" style={{ accentColor: "#F97316" }} />
                <label htmlFor="avail" className="text-white/70 text-sm">Available for booking</label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "#F97316", color: "#0A0E27" }}>
                {editVehicle ? "Save Changes" : "Add Vehicle"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicles list */}
      {loading ? <div className="text-center py-20 text-white/30">Loading…</div> : vehicles.length === 0 ? (
        <div className="text-center py-16 text-white/30">No vehicles yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map(v => {
            const primary = v.cms_vehicle_photos?.find((p: any) => p.is_primary) || v.cms_vehicle_photos?.[0];
            return (
              <div key={v.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex">
                  {primary?.url ? (
                    <img src={primary.url} alt={v.name} className="w-28 h-full object-cover shrink-0" style={{ minHeight: 100 }} />
                  ) : (
                    <div className="w-28 h-24 flex items-center justify-center shrink-0 text-3xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                      {TYPE_ICON[v.type] || "🚗"}
                    </div>
                  )}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-white font-semibold">{v.name}</div>
                        <div className="text-white/40 text-xs mt-0.5">{TYPE_ICON[v.type]} {v.type} · {v.capacity} persons</div>
                        <div className="text-white/60 text-sm font-semibold mt-1">₹{v.price_per_day?.toLocaleString()}/day</div>
                        {v.location && <div className="text-white/30 text-xs mt-0.5">📍 {v.location}</div>}
                      </div>
                      <button onClick={() => toggleAvailability(v.id, v.is_available)}
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                        style={{ background: v.is_available ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: v.is_available ? "#10B981" : "#EF4444" }}>
                        {v.is_available ? "Available" : "Unavailable"}
                      </button>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEdit(v)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>Edit</button>
                      <button onClick={() => setDeleteId(v.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium ml-auto" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>Delete</button>
                    </div>
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
            <div className="text-3xl mb-3">🏍️</div>
            <h3 className="text-white font-bold mb-2">Delete vehicle?</h3>
            <p className="text-white/50 text-sm mb-6">Photos will also be deleted. Cannot be undone.</p>
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
