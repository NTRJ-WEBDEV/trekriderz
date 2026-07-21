import { createClient } from '@/lib/supabase';
import { logAdminAction } from './AuditService';
import type { ApprovalEntity } from './ApprovalService';

// Admin Review Workspace v1 — docs/architecture/PARTNER_PLATFORM.md §9.1/§10.
// Structured Request Changes + per-document status + internal notes for the
// three partner types ApprovalService already manages. Keyed directly on
// (entity_type, entity_id) rather than a formal case entity — see the
// migration header for why.

export type ChangeRequestStatus = 'pending' | 'resolved';
export type DocumentReviewStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface ChangeRequest {
  id: string;
  entity_type: ApprovalEntity;
  entity_id: string;
  field_key: string | null;
  issue: string;
  instructions: string;
  status: ChangeRequestStatus;
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

// ── Change Requests ─────────────────────────────────────────
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

export async function createChangeRequests(
  entityType: ApprovalEntity,
  entityId: string,
  items: { field_key?: string | null; issue: string; instructions: string }[]
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rows = items.map((i) => ({
    entity_type: entityType, entity_id: entityId,
    field_key: i.field_key ?? null, issue: i.issue, instructions: i.instructions,
    created_by: user?.id ?? null,
  }));
  const { error } = await supabase.from('review_change_requests').insert(rows);
  if (error) throw error;
  await logAdminAction({
    action: `${entityType}.changes_requested`, entityType, entityId,
    metadata: { count: items.length, items: items.map((i) => i.issue) },
  });
}

export async function resolveChangeRequest(id: string): Promise<void> {
  const supabase = createClient();
  const { data: row } = await supabase.from('review_change_requests').select('entity_type, entity_id').eq('id', id).maybeSingle();
  const { error } = await supabase.from('review_change_requests').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  if (row) await logAdminAction({ action: `${row.entity_type}.change_resolved`, entityType: row.entity_type, entityId: row.entity_id });
}

// ── Document Status ─────────────────────────────────────────
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

// ── Internal Notes ───────────────────────────────────────────
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
