import { createClient } from '@/lib/supabase';
import { notify } from './NotificationService';
import { logAdminAction } from './AuditService';
import type { ApprovalEntity } from './ApprovalService';

// Admin Review Workspace — docs/architecture/PARTNER_PLATFORM.md §9.1/§10.
// Staff-side of the Review Resolution loop; mirrors mobile/lib/services/
// ReviewWorkspaceService.ts, which holds the partner-side actions (partner
// RLS policies keep each side to its own half regardless of which file is
// called from). Keyed directly on (entity_type, entity_id) rather than a
// formal case entity — see the migration header for why.

export type ChangeRequestStatus = 'requested' | 'partner_working' | 'ready_for_review' | 'resolved' | 'verified';
export type ChangeRequestPriority = 'low' | 'medium' | 'high';
export type DocumentReviewStatus = 'pending' | 'verified' | 'rejected' | 'expired';

interface StatusHistoryEntry {
  status: string;
  actor_id: string | null;
  note?: string;
  at: string;
}

export interface ChangeRequest {
  id: string;
  entity_type: ApprovalEntity;
  entity_id: string;
  field_key: string | null;
  issue: string;
  instructions: string;
  status: ChangeRequestStatus;
  priority: ChangeRequestPriority;
  partner_comment: string | null;
  admin_reference_url: string | null;
  status_history: StatusHistoryEntry[];
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DocumentStatus {
  id: string;
  entity_type: ApprovalEntity;
  entity_id: string;
  document_key: string;
  status: DocumentReviewStatus;
  reviewed_at: string | null;
  expiry_date: string | null;
  replacement_path: string | null;
  replacement_uploaded_at: string | null;
}

export interface InternalNote {
  id: string;
  entity_type: ApprovalEntity;
  entity_id: string;
  author_id: string;
  note: string;
  created_at: string;
  users?: { full_name: string | null } | null;
}

async function appendHistory(id: string, entry: Omit<StatusHistoryEntry, 'at'>) {
  const supabase = createClient();
  const { data: row } = await supabase.from('review_change_requests').select('status_history').eq('id', id).maybeSingle();
  const history: StatusHistoryEntry[] = (row?.status_history as StatusHistoryEntry[]) || [];
  history.push({ ...entry, at: new Date().toISOString() });
  return history;
}

// ── Change Requests (staff) ──────────────────────────────────
export async function fetchChangeRequests(entityType: ApprovalEntity, entityId: string): Promise<ChangeRequest[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('review_change_requests')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  return (data as ChangeRequest[]) || [];
}

// `ownerId` follows the same pattern as ApprovalService.approveListing/
// rejectListing — the caller (a review page) already has the entity's
// owner id loaded, so this doesn't do a second lookup query.
export async function createChangeRequests(
  entityType: ApprovalEntity,
  entityId: string,
  ownerId: string | undefined,
  items: { field_key?: string | null; issue: string; instructions: string; priority?: ChangeRequestPriority; admin_reference_url?: string | null }[]
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const rows = items.map((i) => ({
    entity_type: entityType, entity_id: entityId,
    field_key: i.field_key ?? null, issue: i.issue, instructions: i.instructions,
    priority: i.priority ?? 'medium', admin_reference_url: i.admin_reference_url ?? null,
    created_by: user?.id ?? null,
    status_history: [{ status: 'requested', actor_id: user?.id ?? null, at: now }],
  }));
  const { error } = await supabase.from('review_change_requests').insert(rows);
  if (error) throw error;

  if (ownerId) {
    await notify({
      userId: ownerId, type: 'changes_requested',
      title: 'Changes requested on your listing',
      message: items.length === 1 ? items[0].issue : `${items.length} items need your attention — open the app to review.`,
      relatedId: entityId,
    });
  }
  await logAdminAction({
    action: `${entityType}.changes_requested`, entityType, entityId,
    metadata: { count: items.length, items: items.map((i) => i.issue) },
  });
}

export async function markChangeResolved(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: row } = await supabase.from('review_change_requests').select('entity_type, entity_id').eq('id', id).maybeSingle();
  const history = await appendHistory(id, { status: 'resolved', actor_id: user?.id ?? null });
  const { error } = await supabase.from('review_change_requests').update({ status: 'resolved', resolved_at: new Date().toISOString(), status_history: history }).eq('id', id);
  if (error) throw error;
  if (row) await logAdminAction({ action: `${row.entity_type}.change_resolved`, entityType: row.entity_type, entityId: row.entity_id });
}

export async function markChangeVerified(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: row } = await supabase.from('review_change_requests').select('entity_type, entity_id').eq('id', id).maybeSingle();
  const history = await appendHistory(id, { status: 'verified', actor_id: user?.id ?? null });
  const { error } = await supabase.from('review_change_requests').update({ status: 'verified', status_history: history }).eq('id', id);
  if (error) throw error;
  if (row) await logAdminAction({ action: `${row.entity_type}.change_verified`, entityType: row.entity_type, entityId: row.entity_id });
}

// Staff sends an item back to the partner after reviewing a "ready for
// review" response and finding it still isn't right — reopens the loop
// without losing the original issue/instructions (a new request would
// lose continuity; this keeps the same row, just like a re-request).
export async function reopenChangeRequest(id: string, note: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: row } = await supabase.from('review_change_requests').select('entity_type, entity_id').eq('id', id).maybeSingle();
  const history = await appendHistory(id, { status: 'requested', actor_id: user?.id ?? null, note });
  const { error } = await supabase.from('review_change_requests').update({ status: 'requested', status_history: history }).eq('id', id);
  if (error) throw error;
  if (row) await logAdminAction({ action: `${row.entity_type}.change_reopened`, entityType: row.entity_type, entityId: row.entity_id, reason: note });
}

// ── Document Status (staff) ──────────────────────────────────
export async function fetchDocumentStatuses(entityType: ApprovalEntity, entityId: string): Promise<DocumentStatus[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('review_document_status')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  return (data as DocumentStatus[]) || [];
}

export async function setDocumentStatus(
  entityType: ApprovalEntity, entityId: string, documentKey: string,
  status: DocumentReviewStatus, expiryDate?: string | null
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('review_document_status').upsert({
    entity_type: entityType, entity_id: entityId, document_key: documentKey,
    status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString(),
    expiry_date: expiryDate ?? null,
  }, { onConflict: 'entity_type,entity_id,document_key' });
  if (error) throw error;
  await logAdminAction({
    action: `${entityType}.document_reviewed`, entityType, entityId,
    metadata: { document_key: documentKey }, newValue: { status },
  });
}

// A staged replacement (mobile-uploaded) is stored as a raw storage path,
// not a URL — private-bucket signed URLs expire, so nothing durable can be
// stored except the path. Call this to get a short-lived viewable link,
// generated on demand rather than cached anywhere.
export async function getSignedDocumentUrl(path: string, expiresInSeconds = 7200): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from('guide-documents').createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

// ── Internal Notes (staff-only, never partner-visible) ───────
export async function fetchInternalNotes(entityType: ApprovalEntity, entityId: string): Promise<InternalNote[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('review_internal_notes')
    .select('*, users:author_id(full_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  return (data as InternalNote[]) || [];
}

export async function addInternalNote(entityType: ApprovalEntity, entityId: string, note: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('review_internal_notes').insert({
    entity_type: entityType, entity_id: entityId, author_id: user?.id ?? null, note,
  });
  if (error) throw error;
}
