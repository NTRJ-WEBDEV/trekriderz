import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_PASSWORD = "trekriderz2026";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = serviceClient();
  const { action, table, id, payload } = body;

  try {
    if (action === "update") {
      const { error } = await sb.from(table).update(payload).eq("id", id);
      if (error) throw error;
    } else if (action === "insert") {
      const { error } = await sb.from(table).insert(payload);
      if (error) throw error;
    } else if (action === "delete") {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
