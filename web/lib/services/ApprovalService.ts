import { createClient } from '@/lib/supabase';
import { notify } from './NotificationService';
import { logAdminAction } from './AuditService';

// Mirrors mobile/lib/services/ApprovalService.ts exactly — same entity
// keys ('homestays' → properties, 'guides' → guides, 'vehicles' →
// rental_vehicles), same notification types, same audit action names.
// Two front-ends (Mobile Operations, Web Admin), one approval
// implementation per entity — this file is that implementation for web,
// not a second one.
export type ApprovalEntity = 'homestays' | 'guides' | 'vehicles';

interface EntityConfig {
  table: string;
  ownerField: string;
  approveExtra: (actorId: string) => Record<string, unknown>;
  supportsRejectionReason: boolean;
  approvedNotification: { type: 'homestay_approved' | 'guide_approved' | 'other'; title: string; message: string };
  rejectedTitle: string;
}

const CONFIG: Record<ApprovalEntity, EntityConfig> = {
  homestays: {
    table: 'properties',
    ownerField: 'owner_id',
    approveExtra: (actorId) => ({ approved_at: new Date().toISOString(), approved_by: actorId }),
    supportsRejectionReason: true,
    approvedNotification: { type: 'homestay_approved', title: 'Property Approved!', message: 'Your property listing has been verified on TrekRiderz.' },
    rejectedTitle: 'Property Not Approved',
  },
  guides: {
    table: 'guides',
    ownerField: 'user_id',
    approveExtra: (actorId) => ({ verified_at: new Date().toISOString(), verified_by: actorId }),
    supportsRejectionReason: true,
    approvedNotification: { type: 'guide_approved', title: 'Guide profile Approved!', message: 'Your guide profile has been verified on TrekRiderz.' },
    rejectedTitle: 'Guide profile Not Approved',
  },
  vehicles: {
    table: 'rental_vehicles',
    ownerField: 'owner_id',
    approveExtra: () => ({}),
    supportsRejectionReason: false,
    approvedNotification: { type: 'other', title: 'Vehicle listing Approved!', message: 'Your vehicle listing has been verified on TrekRiderz.' },
    rejectedTitle: 'Vehicle listing Not Approved',
  },
};

// Single read-by-id used by the three review pages (guides/[id],
// homestays/[id], rentals/[id]) — reuses the same entity→table map every
// mutation in this file already goes through, so a review page and an
// approve/reject action can never disagree about which table an entity
// key points to. `select` defaults to '*'; callers that need an owner
// join (guides only — see guides/[id]/page.tsx) pass their own.
export async function getListingById(entity: ApprovalEntity, id: string, select = '*') {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  return supabase.from(cfg.table).select(select).eq('id', id).maybeSingle();
}

export async function approveListing(entity: ApprovalEntity, id: string, ownerId: string | undefined, actorId: string): Promise<void> {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  const { error } = await supabase.from(cfg.table).update({ status: 'approved', ...cfg.approveExtra(actorId) }).eq('id', id);
  if (error) throw error;

  if (ownerId) {
    await notify({ userId: ownerId, type: cfg.approvedNotification.type, title: cfg.approvedNotification.title, message: cfg.approvedNotification.message, relatedId: id });
  }
  await logAdminAction({ action: `${entity}.approved`, entityType: entity, entityId: id, newValue: { status: 'approved' } });
}

export async function rejectListing(entity: ApprovalEntity, id: string, ownerId: string | undefined, reason: string): Promise<void> {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  const updatePayload: Record<string, unknown> = { status: 'rejected' };
  if (cfg.supportsRejectionReason) updatePayload.rejection_reason = reason;

  const { error } = await supabase.from(cfg.table).update(updatePayload).eq('id', id);
  if (error) throw error;

  if (ownerId) {
    await notify({ userId: ownerId, type: 'other', title: cfg.rejectedTitle, message: reason, relatedId: id });
  }
  await logAdminAction({ action: `${entity}.rejected`, entityType: entity, entityId: id, reason, newValue: { status: 'rejected' } });
}

export async function setFeatured(entity: ApprovalEntity, id: string, featured: boolean): Promise<void> {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  const { error } = await supabase.from(cfg.table).update({ is_featured: featured }).eq('id', id);
  if (error) throw error;
  await logAdminAction({ action: featured ? `${entity}.featured` : `${entity}.unfeatured`, entityType: entity, entityId: id, newValue: { is_featured: featured } });
}

export async function setSuspended(entity: 'homestays' | 'vehicles', id: string, suspended: boolean): Promise<void> {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  const { error } = await supabase.from(cfg.table).update({ is_suspended: suspended }).eq('id', id);
  if (error) throw error;
  await logAdminAction({ action: suspended ? `${entity}.suspended` : `${entity}.unsuspended`, entityType: entity, entityId: id, newValue: { is_suspended: suspended } });
}

// Guides has no is_suspended column — is_active already serves that role
// (is_active = false means suspended), so it gets its own function rather
// than forcing a column that would duplicate an existing one.
export async function setGuideActive(id: string, active: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('guides').update({ is_active: active }).eq('id', id);
  if (error) throw error;
  await logAdminAction({ action: active ? 'guides.unsuspended' : 'guides.suspended', entityType: 'guides', entityId: id, newValue: { is_active: active } });
}

export async function deleteListing(entity: ApprovalEntity, id: string, previousValue?: unknown): Promise<void> {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  const { error } = await supabase.from(cfg.table).delete().eq('id', id);
  if (error) throw error;
  await logAdminAction({ action: `${entity}.deleted`, entityType: entity, entityId: id, previousValue });
}
