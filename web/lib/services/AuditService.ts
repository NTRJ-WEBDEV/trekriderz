import { createClient } from '@/lib/supabase';

export interface ActivityLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_role: string | null;
  reason: string | null;
  created_at: string;
  source: string;
}

// Read side of admin_activity_log, for the per-listing "Activity" section
// on the guides/homestays/rentals review pages. entity_type values for
// those three flows are the literal ApprovalEntity strings ('guides',
// 'homestays', 'vehicles') that logAdminAction below already writes —
// see ApprovalService.ts's CONFIG map.
export async function getActivityForEntity(entityType: string, entityId: string, limit = 20): Promise<ActivityLogRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('admin_activity_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as ActivityLogRow[]) || [];
}

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
