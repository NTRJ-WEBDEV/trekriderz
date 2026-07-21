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
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  // TEMP DIAGNOSTIC — remove once the production login-redirect issue is
  // confirmed fixed. Logs shape/existence only, never tokens or cookies.
  console.log('[admin-auth-debug] getAdminSession', { hasUser: !!user, userId: user?.id ?? null, userError: userError?.message ?? null });
  if (!user) return null;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, staff_role:roles(key, name)')
    .eq('id', user.id)
    .single();
  // `profiles` rows are auto-created for every auth.users signup (mobile app
  // customers included) with the legacy `role` text column defaulting to
  // 'moderator' — that text value is NOT proof of staff access. Only an
  // explicitly-granted `role_id` (via the RBAC migration or Team screen) is.
  if (!profile || !profile.role_id) {
    console.log('[admin-auth-debug] getAdminSession: no admin access', {
      hasProfile: !!profile,
      roleId: profile?.role_id ?? null,
      profileError: profileError?.message ?? null,
    });
    return null;
  }
  const { data: permissionRows, error: permError } = await supabase.rpc('my_permissions');
  const permissions = (permissionRows || []).map((r: { permission_key: string }) => r.permission_key);
  console.log('[admin-auth-debug] getAdminSession: granted', {
    roleId: profile.role_id,
    permissionCount: permissions.length,
    permError: permError?.message ?? null,
  });
  return { user, profile, permissions };
}
