"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const SETTING_GROUPS = [
  {
    label: "Contact & Social",
    icon: "📱",
    keys: [
      { key: "whatsapp_number", label: "WhatsApp Number", help: "Include country code, no + sign (e.g. 917339231537)", placeholder: "917339231537" },
      { key: "email", label: "Contact Email", help: "Public contact email shown on the website", placeholder: "hello@trekriderz.in" },
      { key: "instagram_url", label: "Instagram URL", help: "Full URL to Instagram profile", placeholder: "https://instagram.com/trekriderz" },
      { key: "youtube_url", label: "YouTube Channel URL", help: "Full URL to YouTube channel", placeholder: "https://youtube.com/@trekriderz" },
    ],
  },
  {
    label: "Homepage Stats",
    icon: "📊",
    keys: [
      { key: "stat_trips", label: "Trips Organized", help: "Number displayed on homepage stats", placeholder: "10" },
      { key: "stat_countries", label: "Countries", help: "Number of countries in stats", placeholder: "6" },
      { key: "stat_trekkers", label: "Happy Trekkers", help: "Community size stat", placeholder: "50" },
      { key: "stat_trails", label: "Trails Covered", help: "Trails/routes stat", placeholder: "15" },
    ],
  },
  {
    label: "SEO & Meta",
    icon: "🔍",
    keys: [
      { key: "site_title", label: "Site Title", help: "Default <title> tag", placeholder: "TrekRiderz — India's Social Trekking Platform" },
      { key: "site_description", label: "Meta Description", help: "Default meta description for SEO", placeholder: "Connect with guides, plan treks, share adventures." },
      { key: "apk_url", label: "Android APK URL", help: "Download link for the Android app", placeholder: "https://..." },
    ],
  },
  {
    label: "Business",
    icon: "🏢",
    keys: [
      { key: "business_address", label: "Business Address", help: "Physical address (shown in footer)", placeholder: "Bengaluru, Karnataka, India" },
      { key: "gst_number", label: "GST Number", help: "GST registration number", placeholder: "29XXXXX..." },
      { key: "maintenance_mode", label: "Maintenance Mode", help: "Set to 'true' to show a maintenance page", placeholder: "false" },
    ],
  },
];

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_settings").select("key, value");
    const map: Record<string, string> = {};
    data?.forEach(r => { map[r.key] = r.value; });
    setSettings(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSetting = async (key: string) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    const value = settings[key] || "";
    const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).single();
    if (existing) {
      await supabase.from("site_settings").update({ value }).eq("key", key);
    } else {
      await supabase.from("site_settings").insert({ key, value });
    }
    setSaving(prev => ({ ...prev, [key]: false }));
    showToast(`Saved: ${key}`);
  };

  const saveAll = async () => {
    const allKeys = SETTING_GROUPS.flatMap(g => g.keys.map(k => k.key));
    setSaving(Object.fromEntries(allKeys.map(k => [k, true])));
    for (const key of allKeys) {
      const value = settings[key] || "";
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).single();
      if (existing) {
        await supabase.from("site_settings").update({ value }).eq("key", key);
      } else {
        await supabase.from("site_settings").insert({ key, value });
      }
    }
    setSaving({});
    showToast("All settings saved!");
  };

  const inp = "flex-1 rounded-xl px-4 py-2.5 text-white text-sm outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl" style={{ background: "#10B981", color: "#fff" }}>{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Site Settings</h1>
          <p className="text-white/40 text-sm mt-0.5">Changes take effect immediately across the public site</p>
        </div>
        <button onClick={saveAll} disabled={loading}
          className="px-5 py-2.5 rounded-xl text-sm font-bold transition-opacity" style={{ background: "#F97316", color: "#0A0E27", opacity: loading ? 0.5 : 1 }}>
          Save All
        </button>
      </div>

      {loading ? <div className="text-center py-20 text-white/30">Loading settings…</div> : (
        <div className="space-y-6">
          {SETTING_GROUPS.map(group => (
            <div key={group.label} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xl">{group.icon}</span>
                <h2 className="text-white font-semibold">{group.label}</h2>
              </div>
              <div className="space-y-5">
                {group.keys.map(({ key, label, help, placeholder }) => (
                  <div key={key}>
                    <label className="text-white/70 text-sm font-medium block mb-1">{label}</label>
                    {help && <p className="text-white/30 text-xs mb-2">{help}</p>}
                    <div className="flex gap-2">
                      <input
                        value={settings[key] || ""}
                        onChange={e => handleChange(key, e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveSetting(key)}
                        placeholder={placeholder}
                        className={inp}
                        style={inpStyle}
                      />
                      <button onClick={() => saveSetting(key)} disabled={saving[key]}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-opacity"
                        style={{ background: "rgba(249,115,22,0.15)", color: "#F97316", opacity: saving[key] ? 0.5 : 1 }}>
                        {saving[key] ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info about what gets updated */}
      <div className="mt-6 rounded-2xl p-5" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
        <p className="text-white/60 text-xs leading-relaxed">
          <span className="font-bold" style={{ color: "#F97316" }}>How settings work:</span> Settings are stored in the Supabase <code className="text-white/50">site_settings</code> table and fetched server-side on each page load. WhatsApp links, stats, social URLs and APK download URL all pull from here.
          Changes are live immediately — no redeploy needed.
        </p>
      </div>
    </div>
  );
}
