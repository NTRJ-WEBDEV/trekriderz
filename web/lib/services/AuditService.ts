import { createClient } from '@/lib/supabase';

interface LogActionParams {
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// The one place every Web Admin mutation writes its audit trail through —
// mirrors mobile/lib/services/AuditService.ts, same table, same shape,
// only `source` differs. RLS on admin_activity_log requires the actor to
// have profiles.role_id set, so this silently no-ops for non-staff.
export async function logAdminAction({
  action, entityType, entityId, previousValue, newValue, reason, metadata,
}: LogActionParams): Promise<void> {
  const supabase = createClient();
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
    source: 'web_admin',
  });
  if (error) console.error('AuditService.logAdminAction failed:', error.message);
}
