import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any));
          } catch {}
        },
      },
    }
  );
}

export async function getAdminSession() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, staff_role:roles(key, name)')
    .eq('id', user.id)
    .single();
  // `profiles` rows are auto-created for every auth.users signup (mobile app
  // customers included) with the legacy `role` text column defaulting to
  // 'moderator' — that text value is NOT proof of staff access. Only an
  // explicitly-granted `role_id` (via the RBAC migration or Team screen) is.
  if (!profile || !profile.role_id) return null;
  const { data: permissionRows } = await supabase.rpc('my_permissions');
  const permissions = (permissionRows || []).map((r: { permission_key: string }) => r.permission_key);
  return { user, profile, permissions };
}
