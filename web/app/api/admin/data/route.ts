import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_PASSWORD = "trekriderz2026";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = serviceClient();

  const results = await Promise.allSettled([
    sb.from("users").select("id", { count: "exact", head: true }),
    sb.from("bookings").select("id", { count: "exact", head: true }),
    sb.from("bookings").select("total_price").eq("payment_status", "paid"),
    sb.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    sb.from("custom_enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    sb.from("guides").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("homestays").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("guided_expeditions").select("id", { count: "exact", head: true }).eq("status", "published"),
    sb.from("trips").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("enquiries").select("*").order("created_at", { ascending: false }),
    sb.from("custom_enquiries").select("*").order("created_at", { ascending: false }),
    sb.from("bookings").select("*, user:user_id(full_name,avatar_url)").order("created_at", { ascending: false }).limit(100),
    sb.from("users").select("id,full_name,email,role,created_at,avatar_url").order("created_at", { ascending: false }).limit(200),
    sb.from("guided_expeditions").select("*, guide:guides(name,is_premium)").order("created_at", { ascending: false }),
    sb.from("trips").select("*").order("created_at", { ascending: false }),
    sb.from("guides").select("*, user:user_id(full_name,avatar_url)").order("created_at", { ascending: false }),
    sb.from("homestays").select("*, owner:owner_id(full_name,avatar_url)").order("created_at", { ascending: false }),
    sb.from("youtube_videos").select("*").order("created_at", { ascending: false }),
    sb.from("communities").select("*, creator:created_by(full_name)").order("created_at", { ascending: false }),
  ]);

  const get = (i: number) =>
    results[i].status === "fulfilled" ? (results[i] as any).value : null;

  const paidBookings: any[] = get(2)?.data || [];
  const revenue = paidBookings.reduce((sum: number, b: any) => sum + (b.total_price || 0), 0);

  return NextResponse.json({
    overview: {
      users: get(0)?.count || 0,
      bookings: get(1)?.count || 0,
      revenue,
      newEnquiries: (get(3)?.count || 0) + (get(4)?.count || 0),
      pendingApprovals: (get(5)?.count || 0) + (get(6)?.count || 0),
      activeExpeditions: get(7)?.count || 0,
      activeWebTrips: get(8)?.count || 0,
    },
    enquiries: get(9)?.data || [],
    customEnquiries: get(10)?.data || [],
    bookings: get(11)?.data || [],
    users: get(12)?.data || [],
    expeditions: get(13)?.data || [],
    trips: get(14)?.data || [],
    guides: get(15)?.data || [],
    homestays: get(16)?.data || [],
    videos: get(17)?.data || [],
    communities: get(18)?.data || [],
  });
}
