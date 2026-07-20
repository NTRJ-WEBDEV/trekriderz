import { supabase } from '../supabase';

// The authorization logic itself lives in the database — has_permission()/
// my_permissions() in 20260720000001_rbac_and_activity_log.sql — so this
// (and web/lib/services/PermissionService.ts) is a thin RPC wrapper, not a
// second implementation. That's what makes it "one RBAC system consumed by
// both products" rather than two parallel role checks.
export async function fetchMyPermissions(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('my_permissions');
  if (error || !data) return new Set();
  return new Set((data as { permission_key: string }[]).map((row) => row.permission_key));
}

export async function checkPermission(key: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_permission', { permission_key: key });
  if (error) return false;
  return !!data;
}
