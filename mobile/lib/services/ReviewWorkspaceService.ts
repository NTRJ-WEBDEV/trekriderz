import { supabase } from '../supabase';
import { uploadMedia } from '../storage';
import { notify } from './NotificationService';

// Partner-side of the Review Resolution Workspace — mirrors
// web/lib/services/ReviewWorkspaceService.ts, which holds the staff-side
// actions. RLS keeps each side to its own half of review_change_requests/
// review_document_status regardless of which file a call comes from; this
// file never touches review_internal_notes (staff-only, no partner policy
// exists for it, by design).

export type ApprovalEntity = 'guides' | 'homestays' | 'vehicles';
export type ChangeRequestStatus = 'requested' | 'partner_working' | 'ready_for_review' | 'resolved' | 'verified';
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
  priority: 'low' | 'medium' | 'high';
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
  replacement_path: string | null;
  replacement_uploaded_at: string | null;
}

const ENTITY_TABLE: Record<ApprovalEntity, string> = { guides: 'guides', homestays: 'properties', vehicles: 'rental_vehicles' };

export async function fetchChangeRequests(entityType: ApprovalEntity, entityId: string): Promise<ChangeRequest[]> {
  const { data } = await supabase
    .from('review_change_requests')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  return (data as ChangeRequest[]) || [];
}

export async function fetchDocumentStatuses(entityType: ApprovalEntity, entityId: string): Promise<DocumentStatus[]> {
  const { data } = await supabase
    .from('review_document_status')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  return (data as DocumentStatus[]) || [];
}

// Count of pending items across all three entity types this user owns —
// drives the "Review Needed" badge in profile/settings.tsx without each
// screen having to know the others exist.
export async function countOpenChangeRequestsForUser(userId: string): Promise<number> {
  const [guideIds, propertyIds, vehicleIds] = await Promise.all([
    supabase.from('guides').select('id').eq('user_id', userId),
    supabase.from('properties').select('id').eq('owner_id', userId),
    supabase.from('rental_vehicles').select('id').eq('owner_id', userId),
  ]);
  const ids = [
    ...(guideIds.data || []).map((r: any) => r.id),
    ...(propertyIds.data || []).map((r: any) => r.id),
    ...(vehicleIds.data || []).map((r: any) => r.id),
  ];
  if (ids.length === 0) return 0;
  const { count } = await supabase
    .from('review_change_requests')
    .select('id', { count: 'exact', head: true })
    .in('entity_id', ids)
    .not('status', 'in', '("resolved","verified")');
  return count || 0;
}

async function appendHistory(id: string, entry: Omit<StatusHistoryEntry, 'at'>) {
  const { data: row } = await supabase.from('review_change_requests').select('status_history').eq('id', id).maybeSingle();
  const history: StatusHistoryEntry[] = (row?.status_history as StatusHistoryEntry[]) || [];
  history.push({ ...entry, at: new Date().toISOString() });
  return history;
}

// Partner adds an explanation/comment on a specific item — nudges it to
// 'partner_working' the first time they touch it (not a separate action
// the partner has to remember to take).
export async function addPartnerComment(id: string, comment: string, userId: string): Promise<void> {
  const { data: row } = await supabase.from('review_change_requests').select('status').eq('id', id).maybeSingle();
  const nextStatus = row?.status === 'requested' ? 'partner_working' : row?.status;
  const history = await appendHistory(id, { status: nextStatus || 'partner_working', actor_id: userId, note: 'comment added' });
  const { error } = await supabase.from('review_change_requests').update({
    partner_comment: comment, status: nextStatus || 'partner_working', status_history: history,
  }).eq('id', id);
  if (error) throw error;
}

// Bulk case-level action — the partner's single "Mark Ready For Review"
// button, matching the brief's flow diagram (a per-item click isn't what
// was asked for; the case as a whole moves forward together). Notifies
// each distinct reviewer who requested an item now being marked ready.
export async function markCaseReadyForReview(entityType: ApprovalEntity, entityId: string, userId: string): Promise<void> {
  const { data: openItems } = await supabase
    .from('review_change_requests')
    .select('id, created_by, status_history')
    .eq('entity_type', entityType).eq('entity_id', entityId)
    .not('status', 'in', '("resolved","verified")');

  const rows = (openItems as any[]) || [];
  if (rows.length === 0) return;

  await Promise.all(rows.map((r) => {
    const history: StatusHistoryEntry[] = (r.status_history as StatusHistoryEntry[]) || [];
    history.push({ status: 'ready_for_review', actor_id: userId, at: new Date().toISOString() });
    return supabase.from('review_change_requests').update({ status: 'ready_for_review', status_history: history }).eq('id', r.id);
  }));

  const reviewers = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean)));
  await Promise.all(reviewers.map((reviewerId) =>
    notify({
      userId: reviewerId, type: 'ready_for_review',
      title: 'A partner marked their changes ready for review',
      message: 'Open the review workspace to re-check their response.',
      relatedId: entityId,
    })
  ));
}

// Stages a replacement document (raw storage path, not a URL — private-
// bucket signed URLs expire, so only the path is durable; the admin side
// generates a fresh signed URL on demand to view it). Never touches the
// entity's own document column — the original stays untouched until
// staff explicitly verifies and, if they choose, applies it.
export async function stageDocumentReplacement(
  entityType: ApprovalEntity, entityId: string, documentKey: string, uri: string, contentType: string, userId: string
): Promise<void> {
  const path = `${userId}/${entityType}-${documentKey}-replacement-${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;
  const publicUrlIgnored = await uploadMedia('guide-documents', path, uri, contentType);
  if (!publicUrlIgnored) throw new Error('Upload failed');

  const { error } = await supabase.from('review_document_status').upsert({
    entity_type: entityType, entity_id: entityId, document_key: documentKey,
    status: 'pending', replacement_path: path, replacement_uploaded_at: new Date().toISOString(),
  }, { onConflict: 'entity_type,entity_id,document_key' });
  if (error) throw error;

  // Touches any change request tied to this exact field so its status
  // reflects that the partner has acted on it, same as addPartnerComment.
  const { data: linked } = await supabase
    .from('review_change_requests').select('id, status, status_history')
    .eq('entity_type', entityType).eq('entity_id', entityId).eq('field_key', documentKey)
    .not('status', 'in', '("resolved","verified")');
  await Promise.all(((linked as any[]) || []).map((r) => {
    const history: StatusHistoryEntry[] = (r.status_history as StatusHistoryEntry[]) || [];
    history.push({ status: 'partner_working', actor_id: userId, note: 'replacement uploaded', at: new Date().toISOString() });
    return supabase.from('review_change_requests').update({ status: 'partner_working', status_history: history }).eq('id', r.id);
  }));
}

export async function getSignedDocumentUrl(path: string, expiresInSeconds = 7200): Promise<string | null> {
  const { data, error } = await supabase.storage.from('guide-documents').createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

// Generic field edit — the partner corrects a flagged field directly on
// their own listing row (existing owner-write RLS on guides/properties/
// rental_vehicles already covers this; nothing new needed there), then
// this call just nudges the linked change request forward the same way
// a comment or document replacement does.
export async function editRequestedField(
  entityType: ApprovalEntity, entityId: string, fieldKey: string, value: string | number, userId: string
): Promise<void> {
  const table = ENTITY_TABLE[entityType];
  const { error } = await supabase.from(table).update({ [fieldKey]: value }).eq('id', entityId);
  if (error) throw error;

  const { data: linked } = await supabase
    .from('review_change_requests').select('id, status_history')
    .eq('entity_type', entityType).eq('entity_id', entityId).eq('field_key', fieldKey)
    .not('status', 'in', '("resolved","verified")');
  await Promise.all(((linked as any[]) || []).map((r) => {
    const history: StatusHistoryEntry[] = (r.status_history as StatusHistoryEntry[]) || [];
    history.push({ status: 'partner_working', actor_id: userId, note: 'field updated', at: new Date().toISOString() });
    return supabase.from('review_change_requests').update({ status: 'partner_working', status_history: history }).eq('id', r.id);
  }));
}
