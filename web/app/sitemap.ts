import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const STATIC_ROUTES = ["", "/trips", "/destinations", "/guides", "/homestays", "/rentals", "/stories", "/community", "/about", "/contact", "/faq", "/special", "/videos", "/plan", "/expeditions"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = db();
  const [trips, expeditions, guides, properties, stories, places] = await Promise.all([
    supabase.from("trips").select("id, updated_at").eq("is_public", true),
    supabase.from("guided_expeditions").select("id, updated_at").eq("status", "published"),
    supabase.from("guides").select("id, updated_at").eq("status", "approved"),
    supabase.from("properties").select("id, updated_at").eq("status", "approved"),
    supabase.from("stories").select("slug, updated_at").eq("status", "approved"),
    supabase.from("places_guide").select("slug, updated_at").eq("status", "approved"),
  ]);

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  (trips.data || []).forEach((t: any) => entries.push({ url: `${SITE_URL}/trips/${t.id}`, lastModified: t.updated_at, changeFrequency: "weekly", priority: 0.8 }));
  (expeditions.data || []).forEach((e: any) => entries.push({ url: `${SITE_URL}/expeditions/${e.id}`, lastModified: e.updated_at, changeFrequency: "weekly", priority: 0.8 }));
  (guides.data || []).forEach((g: any) => entries.push({ url: `${SITE_URL}/guides/${g.id}`, lastModified: g.updated_at, changeFrequency: "monthly", priority: 0.6 }));
  (properties.data || []).forEach((p: any) => entries.push({ url: `${SITE_URL}/homestays/${p.id}`, lastModified: p.updated_at, changeFrequency: "monthly", priority: 0.6 }));
  (stories.data || []).forEach((s: any) => entries.push({ url: `${SITE_URL}/stories/${s.slug}`, lastModified: s.updated_at, changeFrequency: "monthly", priority: 0.6 }));
  (places.data || []).forEach((p: any) => entries.push({ url: `${SITE_URL}/destinations/${p.slug}`, lastModified: p.updated_at, changeFrequency: "monthly", priority: 0.7 }));

  return entries;
}
