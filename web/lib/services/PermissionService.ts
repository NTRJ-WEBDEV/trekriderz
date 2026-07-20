import { createClient } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';

// The authorization logic itself lives in the database — has_permission()/
// my_permissions() in supabase/migrations/20260720000001_rbac_and_activity_log.sql
// — so this (and mobile/lib/services/PermissionService.ts) is a thin RPC
// wrapper, not a second implementation. One RBAC system, two thin clients.
export async function fetchMyPermissionsClient(): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('my_permissions');
  if (error || !data) return new Set();
  return new Set((data as { permission_key: string }[]).map((row) => row.permission_key));
}

export async function fetchMyPermissionsServer(): Promise<Set<string>> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('my_permissions');
  if (error || !data) return new Set();
  return new Set((data as { permission_key: string }[]).map((row) => row.permission_key));
}
