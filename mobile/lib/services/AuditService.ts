import { supabase } from '../supabase';

interface LogActionParams {
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// The one place every admin mutation writes its audit trail through.
// RLS on admin_activity_log requires the actor to have a profiles.role_id
// set (see 20260720000001_rbac_and_activity_log.sql), so this silently
// no-ops for non-staff callers rather than throwing.
export async function logAdminAction({
  action, entityType, entityId, previousValue, newValue, reason, metadata,
}: LogActionParams): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role:roles(key)')
    .eq('id', user.id)
    .maybeSingle();

  const { error } = await supabase.from('admin_activity_log').insert({
    actor_id: user.id,
    actor_role: (profile as any)?.role?.key ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    previous_value: previousValue ?? null,
    new_value: newValue ?? null,
    reason: reason ?? null,
    metadata: metadata ?? null,
    source: 'mobile_ops',
  });
  if (error) console.error('AuditService.logAdminAction failed:', error.message);
}
