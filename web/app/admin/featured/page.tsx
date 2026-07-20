"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { setFeatured, ApprovalEntity } from "@/lib/services/ApprovalService";
import { logAdminAction } from "@/lib/services/AuditService";
import { useAdminPermissions } from "@/lib/adminPermissions";

// One aggregated view across every entity that can be featured, instead of
// a "featured" filter tab buried in seven different modules — this is the
// module's actual distinguishing use case (what's live on the future home
// feed right now, across all types, at a glance).
interface FeaturedItem {
  id: string;
  entity: string;
  approvalEntity?: ApprovalEntity;
  label: string;
  sublabel?: string;
  table: string;
}

export default function FeaturedPage() {
  const { hasPermission } = useAdminPermissions();
  const supabase = createClient();
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [guides, properties, vehicles, expeditions, communities, posts] = await Promise.all([
      supabase.from("guides").select("id, full_name, name, location").eq("is_featured", true),
      supabase.from("properties").select("id, name, city").eq("is_featured", true),
      supabase.from("rental_vehicles").select("id, make, model, vehicle_type").eq("is_featured", true),
      supabase.from("guided_expeditions").select("id, title, destination").eq("is_featured", true),
      supabase.from("communities").select("id, name, category").eq("is_featured", true),
      supabase.from("posts").select("id, content, post_type").eq("is_featured", true),
    ]);

    const all: FeaturedItem[] = [
      ...(guides.data || []).map((g: any) => ({ id: g.id, entity: "Guide", approvalEntity: "guides" as ApprovalEntity, label: g.full_name || g.name, sublabel: g.location, table: "guides" })),
      ...(properties.data || []).map((p: any) => ({ id: p.id, entity: "Homestay", approvalEntity: "homestays" as ApprovalEntity, label: p.name, sublabel: p.city, table: "properties" })),
      ...(vehicles.data || []).map((v: any) => ({ id: v.id, entity: "Rental", approvalEntity: "vehicles" as ApprovalEntity, label: [v.make, v.model].filter(Boolean).join(" ") || v.vehicle_type, table: "rental_vehicles" })),
      ...(expeditions.data || []).map((e: any) => ({ id: e.id, entity: "Expedition", label: e.title, sublabel: e.destination, table: "guided_expeditions" })),
      ...(communities.data || []).map((c: any) => ({ id: c.id, entity: "Community", label: c.name, sublabel: c.category, table: "communities" })),
      ...(posts.data || []).map((p: any) => ({ id: p.id, entity: p.post_type === "reel" ? "Reel" : p.post_type === "trip_story" ? "Travel Story" : "Post", label: (p.content || "").slice(0, 60) || "(no caption)", table: "posts" })),
    ];
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const unfeature = async (item: FeaturedItem) => {
    if (item.approvalEntity) {
      await setFeatured(item.approvalEntity, item.id, false);
    } else {
      await supabase.from(item.table).update({ is_featured: false }).eq("id", item.id);
      await logAdminAction({ action: `${item.table}.unfeatured`, entityType: item.table, entityId: item.id, newValue: { is_featured: false } });
    }
    load();
  };

  const grouped = items.reduce<Record<string, FeaturedItem[]>>((acc, item) => {
    (acc[item.entity] = acc[item.entity] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Featured Content</h1>
        <p className="text-white/40 text-sm mt-0.5">Everything currently marked featured across the platform — this is what the future home feed will consume.</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/30">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-white/40">Nothing featured yet. Use the "Feature" action inside Guides, Homestays, Rentals, Expeditions, Communities, or Content Moderation.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([entity, rows]) => (
            <div key={entity} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-5 py-3 text-white font-semibold text-sm flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span>{entity}s</span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}>{rows.length}</span>
              </div>
              {rows.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
                  <div className="min-w-0">
                    <div className="text-white/80 text-sm truncate">{item.label}</div>
                    {item.sublabel && <div className="text-white/30 text-xs truncate">{item.sublabel}</div>}
                  </div>
                  {hasPermission("featured.manage") && (
                    <button onClick={() => unfeature(item)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                      Unfeature
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
