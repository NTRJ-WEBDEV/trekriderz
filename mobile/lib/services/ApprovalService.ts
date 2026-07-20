import { supabase } from '../supabase';
import { notify } from './NotificationService';
import { logAdminAction } from './AuditService';

// Homestays (`properties` table) and Guides already shared one
// approve/reject implementation in admin/index.tsx; Vehicles
// (`rental_vehicles`) had a copy-pasted, diverging inline version that
// skipped the owner notification entirely. This unifies all three behind
// one function instead of three near-identical blocks.
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
    // rental_vehicles has no rejection_reason column today — matches the
    // pre-existing inline behavior this replaces; the reason still reaches
    // the owner via the notification message and is captured in the audit log.
    supportsRejectionReason: false,
    approvedNotification: { type: 'other', title: 'Vehicle listing Approved!', message: 'Your vehicle listing has been verified on TrekRiderz.' },
    rejectedTitle: 'Vehicle listing Not Approved',
  },
};

export async function approveListing(entity: ApprovalEntity, id: string, ownerId: string | undefined, actorId: string): Promise<void> {
  const cfg = CONFIG[entity];
  const { error } = await supabase.from(cfg.table).update({ status: 'approved', ...cfg.approveExtra(actorId) }).eq('id', id);
  if (error) throw error;

  if (ownerId) {
    await notify({
      userId: ownerId,
      type: cfg.approvedNotification.type,
      title: cfg.approvedNotification.title,
      message: cfg.approvedNotification.message,
      relatedId: id,
    });
  }
  await logAdminAction({ action: `${entity}.approved`, entityType: entity, entityId: id, newValue: { status: 'approved' } });
}

export async function rejectListing(entity: ApprovalEntity, id: string, ownerId: string | undefined, reason: string): Promise<void> {
  const cfg = CONFIG[entity];
  const updatePayload: Record<string, unknown> = { status: 'rejected' };
  if (cfg.supportsRejectionReason) updatePayload.rejection_reason = reason;

  const { error } = await supabase.from(cfg.table).update(updatePayload).eq('id', id);
  if (error) throw error;

  if (ownerId) {
    await notify({
      userId: ownerId,
      // 'system' is not a valid notifications.type — every rejection
      // notification through the old inline code was silently dropped by
      // the CHECK constraint. 'other' is the correct catch-all value.
      type: 'other',
      title: cfg.rejectedTitle,
      message: reason,
      relatedId: id,
    });
  }
  await logAdminAction({ action: `${entity}.rejected`, entityType: entity, entityId: id, reason, newValue: { status: 'rejected' } });
}
