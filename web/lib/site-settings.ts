import { createClient } from "@supabase/supabase-js";

export interface SiteSettings {
  whatsapp_number: string;
  email: string;
  instagram_url: string;
  youtube_url: string;
  stat_trips: string;
  stat_countries: string;
  stat_trekkers: string;
  stat_trails: string;
}

const DEFAULTS: SiteSettings = {
  whatsapp_number: "917339231537",
  email: "hello@trekriderz.com",
  instagram_url: "https://instagram.com/trekriderz",
  youtube_url: "https://youtube.com/@trekriderz",
  stat_trips: "200",
  stat_countries: "6",
  stat_trekkers: "1500",
  stat_trails: "35",
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase.from("site_settings").select("key, value");
    if (!data || data.length === 0) return DEFAULTS;
    const map: Record<string, string> = {};
    data.forEach((row: { key: string; value: string }) => {
      map[row.key] = row.value;
    });
    return { ...DEFAULTS, ...map } as SiteSettings;
  } catch {
    return DEFAULTS;
  }
}
