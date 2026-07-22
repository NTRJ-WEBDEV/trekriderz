import { createClient } from '@/lib/supabase';
import { notify } from './NotificationService';
import { logAdminAction } from './AuditService';
import { setSuspended, setGuideActive, type ApprovalEntity } from './ApprovalService';

// Partner Audit & Reverification System — docs/architecture/
// PARTNER_PLATFORM.md §8. NOT Trust Score — that's a later milestone
// that reads this data (audit recency/pass-rate) as one of its inputs.

export type AuditType = 'video' | 'physical' | 'document_only' | 'component_refresh';
export type AuditOutcome = 'pass' | 'minor_issues' | 'fail';
export type ScheduleStatus = 'active' | 'overdue' | 'hidden_overdue';
export type ReminderTier = '60d' | '30d' | '14d' | '7d' | '1d' | 'overdue' | null;

export interface AuditChecklist {
  photos_refreshed?: boolean;
  facility_verified?: boolean;
  price_verified?: boolean;
  nearby_attractions_verified?: boolean;
  location_verified?: boolean;
  condition_report?: string;
}

export interface AuditSchedule {
  id: string;
  entity_type: ApprovalEntity;
  entity_id: string;
  cadence_months: number;
  next_due_date: string;
  last_photo_refresh_at: string | null;
  last_reminder_sent_at: string | null;
  last_reminder_tier: string | null;
  consecutive_clean_audits: number;
  status: ScheduleStatus;
}

export interface AuditQueueRow extends AuditSchedule {
  entityName: string;
  ownerId: string | null;
  reminderTier: ReminderTier;
  daysUntilDue: number;
}

export interface AuditRecord {
  id: string;
  entity_type: ApprovalEntity;
  entity_id: string;
  audit_type: AuditType;
  checklist: AuditChecklist;
  photo_set: string[];
  outcome: AuditOutcome | null;
  notes: string | null;
  auditor_id: string | null;
  completed_at: string | null;
  created_at: string;
}

const ENTITY_TABLE: Record<ApprovalEntity, string> = { guides: 'guides', homestays: 'properties', vehicles: 'rental_vehicles' };
const ENTITY_NAME_FIELD: Record<ApprovalEntity, string> = { guides: 'full_name', homestays: 'name', vehicles: 'make' };
const ENTITY_OWNER_FIELD: Record<ApprovalEntity, string> = { guides: 'user_id', homestays: 'owner_id', vehicles: 'owner_id' };

function computeReminderTier(dueDate: string): ReminderTier {
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= 1) return '1d';
  if (days <= 7) return '7d';
  if (days <= 14) return '14d';
  if (days <= 30) return '30d';
  if (days <= 60) return '60d';
  return null;
}

// One query per entity type for names/owners (bounded, not one per row) —
// same "avoid N+1" discipline as DashboardService.
export async function fetchAuditQueue(): Promise<AuditQueueRow[]> {
  const supabase = createClient();
  const { data: schedules } = await supabase
    .from('partner_audit_schedule')
    .select('*')
    .neq('status', 'hidden_overdue')
    .order('next_due_date', { ascending: true });

  const rows = (schedules as AuditSchedule[]) || [];
  const idsByType: Record<ApprovalEntity, string[]> = { guides: [], homestays: [], vehicles: [] };
  rows.forEach((r) => idsByType[r.entity_type].push(r.entity_id));

  const nameMaps: Record<ApprovalEntity, Record<string, { name: string; owner: string | null }>> = { guides: {}, homestays: {}, vehicles: {} };
  await Promise.all((Object.keys(idsByType) as ApprovalEntity[]).map(async (type) => {
    if (idsByType[type].length === 0) return;
    const { data } = await supabase.from(ENTITY_TABLE[type]).select(`id, ${ENTITY_NAME_FIELD[type]}, ${ENTITY_OWNER_FIELD[type]}`).in('id', idsByType[type]);
    (data as any[] || []).forEach((row) => {
      nameMaps[type][row.id] = { name: row[ENTITY_NAME_FIELD[type]] || 'Untitled', owner: row[ENTITY_OWNER_FIELD[type]] || null };
    });
  }));

  return rows.map((r) => ({
    ...r,
    entityName: nameMaps[r.entity_type][r.entity_id]?.name || 'Unknown',
    ownerId: nameMaps[r.entity_type][r.entity_id]?.owner || null,
    reminderTier: computeReminderTier(r.next_due_date),
    daysUntilDue: Math.ceil((new Date(r.next_due_date).getTime() - Date.now()) / 86400000),
  }));
}

export async function fetchAuditHistory(entityType: ApprovalEntity, entityId: string): Promise<AuditRecord[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('partner_audit_records')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  return (data as AuditRecord[]) || [];
}

export async function fetchScheduleFor(entityType: ApprovalEntity, entityId: string): Promise<AuditSchedule | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('partner_audit_schedule')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();
  return data as AuditSchedule | null;
}

// Records an audit and moves the schedule forward per §8.1/§8.5:
// pass -> resets clock at (possibly extended) cadence; 3+ consecutive
// clean audits earns a longer cadence (capped at 12mo). minor_issues ->
// short 7-day correction window, doesn't touch cadence. fail -> due
// immediately and the listing is suspended right away (via the existing
// ApprovalService suspend functions, not a new mechanism) until
// reverified.
export async function recordAuditOutcome(
  entityType: ApprovalEntity, entityId: string, ownerId: string | undefined,
  input: { audit_type: AuditType; checklist: AuditChecklist; photo_set: string[]; outcome: AuditOutcome; notes?: string },
  auditorId: string
): Promise<void> {
  const supabase = createClient();

  const { error: insertErr } = await supabase.from('partner_audit_records').insert({
    entity_type: entityType, entity_id: entityId,
    audit_type: input.audit_type, checklist: input.checklist, photo_set: input.photo_set,
    outcome: input.outcome, notes: input.notes ?? null, auditor_id: auditorId, completed_at: new Date().toISOString(),
  });
  if (insertErr) throw insertErr;

  const schedule = await fetchScheduleFor(entityType, entityId);
  const cadence = schedule?.cadence_months ?? 6;
  const cleanStreak = schedule?.consecutive_clean_audits ?? 0;

  let nextDueDate: Date;
  let newCadence = cadence;
  let newStreak = cleanStreak;
  let newStatus: ScheduleStatus = 'active';

  if (input.outcome === 'pass') {
    newStreak = cleanStreak + 1;
    if (newStreak >= 3 && cadence < 12) newCadence = Math.min(12, cadence + 3);
    nextDueDate = new Date(Date.now() + newCadence * 30 * 86400000);
  } else if (input.outcome === 'minor_issues') {
    newStreak = 0;
    nextDueDate = new Date(Date.now() + 7 * 86400000);
  } else {
    newStreak = 0;
    nextDueDate = new Date(); // due immediately — stays "overdue" until a new pass is recorded
    newStatus = 'overdue';
  }

  const { error: upsertErr } = await supabase.from('partner_audit_schedule').upsert({
    entity_type: entityType, entity_id: entityId,
    cadence_months: newCadence, next_due_date: nextDueDate.toISOString().split('T')[0],
    consecutive_clean_audits: newStreak, status: newStatus,
    last_photo_refresh_at: input.checklist.photos_refreshed ? new Date().toISOString() : schedule?.last_photo_refresh_at ?? null,
    last_reminder_sent_at: null, last_reminder_tier: null, // reset — a fresh audit clears the reminder cadence
    updated_at: new Date().toISOString(),
  }, { onConflict: 'entity_type,entity_id' });
  if (upsertErr) throw upsertErr;

  if (input.outcome === 'fail') {
    if (entityType === 'guides') await setGuideActive(entityId, false);
    else await setSuspended(entityType as 'homestays' | 'vehicles', entityId, true);
    if (ownerId) {
      await notify({
        userId: ownerId, type: 'audit_reminder',
        title: 'Your listing has been suspended after audit',
        message: input.notes || 'Your listing did not pass its scheduled re-verification. Please contact support to reverify.',
        relatedId: entityId,
      });
    }
  }

  await logAdminAction({
    action: `${entityType}.audit_recorded`, entityType, entityId,
    newValue: { outcome: input.outcome, audit_type: input.audit_type }, reason: input.notes,
  });
}

export async function sendReminderNow(entityType: ApprovalEntity, entityId: string, ownerId: string): Promise<void> {
  const supabase = createClient();
  await notify({
    userId: ownerId, type: 'audit_reminder',
    title: 'Re-verification reminder',
    message: 'Your listing is due for a routine re-verification soon. Please make sure your details and photos are current.',
    relatedId: entityId,
  });
  await supabase.from('partner_audit_schedule').update({ last_reminder_sent_at: new Date().toISOString() })
    .eq('entity_type', entityType).eq('entity_id', entityId);
}

// Manual, human-triggered — deliberately not part of the automated cron
// (see migration header). Hides the listing the same way any other
// suspend already works (setSuspended/setGuideActive), just tagged with
// an audit-specific reason and schedule status.
export async function hideOverdueListing(entityType: ApprovalEntity, entityId: string, ownerId: string | undefined): Promise<void> {
  const supabase = createClient();
  if (entityType === 'guides') await setGuideActive(entityId, false);
  else await setSuspended(entityType as 'homestays' | 'vehicles', entityId, true);

  await supabase.from('partner_audit_schedule').update({ status: 'hidden_overdue' }).eq('entity_type', entityType).eq('entity_id', entityId);

  if (ownerId) {
    await notify({
      userId: ownerId, type: 'audit_reminder',
      title: 'Your listing has been hidden',
      message: 'Your listing was hidden after remaining overdue for re-verification. Complete your audit to go live again.',
      relatedId: entityId,
    });
  }
  await logAdminAction({ action: `${entityType}.hidden_overdue_audit`, entityType, entityId });
}

export async function updateSchedule(entityType: ApprovalEntity, entityId: string, nextDueDate: string, cadenceMonths: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('partner_audit_schedule').upsert({
    entity_type: entityType, entity_id: entityId, next_due_date: nextDueDate, cadence_months: cadenceMonths, status: 'active', updated_at: new Date().toISOString(),
  }, { onConflict: 'entity_type,entity_id' });
  if (error) throw error;
  await logAdminAction({ action: `${entityType}.audit_scheduled`, entityType, entityId, newValue: { next_due_date: nextDueDate, cadence_months: cadenceMonths } });
}
