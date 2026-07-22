import { supabase } from '../supabase';
import type { ApprovalEntity } from './ApprovalService';

// Internal Trust Engine (Phase 1) — mirrors
// web/lib/services/TrustEngineService.ts. This half is partner-facing:
// it deliberately NEVER exposes an overall health label, a risk score, or
// anything that reads like "your Trust Score is X." The partner only
// ever sees actionable checklist items — profile completion, what's
// missing, what's overdue, what to do next. The admin-only breakdown
// (overallHealth, strengths/weaknesses framing) stays in the web service.
//
// The raw numbers are computed ONCE, in the database
// (compute_partner_trust_factors) — this file only formats them for the
// partner. Same RPC, same numbers, as the web admin side; only the label
// strings are written twice, per this codebase's mirrored-service
// convention.

export type TrustEventType =
  | 'audit_passed' | 'audit_minor_issues' | 'audit_failed'
  | 'document_verified' | 'document_rejected' | 'document_expired'
  | 'photo_refreshed' | 'policy_violation'
  | 'account_suspended' | 'account_reinstated';
export type TrustEventImpact = 'positive' | 'negative' | 'neutral';

export interface TrustEvent {
  id: string;
  entity_type: ApprovalEntity;
  entity_id: string;
  event_type: TrustEventType;
  description: string;
  impact: TrustEventImpact;
  created_at: string;
}

// Kept 1:1 with the SQL function's jsonb keys — see the web service for
// the full field-by-field rationale.
export interface RawTrustFactors {
  entity_type: ApprovalEntity;
  entity_id: string;
  status: string;
  is_suspended: boolean;
  created_at: string;
  profile_completeness_pct: number;
  has_identity_verification: boolean;
  business_verification_applicable: boolean;
  has_business_verification: boolean;
  audit_count: number;
  last_audit_outcome: 'pass' | 'minor_issues' | 'fail' | null;
  days_since_last_audit: number | null;
  consecutive_clean_audits: number;
  next_audit_due_date: string | null;
  audit_overdue: boolean;
  days_since_photo_refresh: number | null;
  document_total: number;
  document_verified: number;
  document_rejected: number;
  document_expired: number;
  document_pending: number;
  open_change_requests: number;
  overdue_change_requests: number;
  policy_violations_recent: number;
  suspension_count: number;
  reinstatement_count: number;
  customer_issue_count: null;
}

// Partner Experience shape — PARTNER_PLATFORM.md §7: "Do NOT show Trust
// Score. Instead show: Profile Completion, Verification Progress,
// Outstanding Actions, Audit Status, Pending Documents, Recommendations."
// No field here is a score, rank, or health label.
export interface PartnerTrustChecklist {
  profileCompletionPct: number;
  verification: { label: string; done: boolean }[];
  outstandingActions: string[];
  auditStatus: { label: string; tone: 'ok' | 'warning' | 'attention' };
  pendingDocuments: { label: string; count: number }[];
  recommendations: string[];
}

const PROFILE_COMPLETE_THRESHOLD = 80; // matches web — "substantially complete" bar
const RESPONSE_OVERDUE_DAYS = 14; // matches web/SQL "open >14 days" framing

// ── Public (traveller-facing) trust signals ──────────────────
// Traveller Discovery Experience — UX_BLUEPRINT.md §4: "Do NOT expose
// internal trust values. Instead expose meaningful signals... Never show
// an unexplained number." This calls a SEPARATE, narrower SQL function
// (compute_public_trust_signals) than the admin/partner one above — not
// the same RawTrustFactors with a permission check removed. No score, no
// risk label, no counts of anything negative (violations, suspensions,
// overdue items) ever appear here.

export interface RawPublicTrustSignals {
  entity_type: ApprovalEntity;
  entity_id: string;
  status: string;
  created_at: string;
  has_identity_verification: boolean;
  business_verification_applicable: boolean;
  has_business_verification: boolean;
  last_audit_outcome: 'pass' | 'minor_issues' | 'fail' | null;
  days_since_last_audit: number | null;
  days_since_photo_refresh: number | null;
}

export interface PublicTrustSignal {
  key: string;
  icon: string; // Ionicons name
  label: string;
  explanation: string; // shown on tap — "tap-to-explain, never a bare icon" (UX_BLUEPRINT.md §4)
}

const RECENT_AUDIT_DAYS = 400; // a little over a year — matches the ~annual audit cadence elsewhere
const FRESH_PHOTO_DAYS = 365; // matches PHOTO_STALE_DAYS on the web admin side

export async function fetchPublicTrustSignals(entityType: ApprovalEntity, entityId: string): Promise<RawPublicTrustSignals> {
  const { data, error } = await supabase.rpc('compute_public_trust_signals', { p_entity_type: entityType, p_entity_id: entityId });
  if (error) throw error;
  return data as RawPublicTrustSignals;
}

function yearsOrMonthsSince(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const years = Math.floor(days / 365);
  if (years >= 1) return `${years} year${years > 1 ? 's' : ''} on TrekRiderz`;
  const months = Math.max(1, Math.floor(days / 30));
  return `${months} month${months > 1 ? 's' : ''} on TrekRiderz`;
}

// Turns the narrow public factor set into plain-language badges. Every
// badge is a positive, real, currently-true fact — nothing is shown as a
// warning or absence (e.g. no "Not verified" badge), matching how the
// rest of this app treats trust: explain what WAS checked, never shame
// what wasn't.
export function interpretPublicSignals(f: RawPublicTrustSignals): PublicTrustSignal[] {
  const badges: PublicTrustSignal[] = [];

  if (f.status === 'approved') {
    badges.push({
      key: 'verified', icon: 'checkmark-circle',
      label: 'Verified by TrekRiderz',
      explanation: 'Our team checked this listing’s identity documents and details before it went live.',
    });
  }
  if (f.has_identity_verification) {
    badges.push({
      key: 'identity', icon: 'card-outline',
      label: 'Identity verified',
      explanation: 'The person behind this listing submitted a government ID that our team checked.',
    });
  }
  if (f.business_verification_applicable && f.has_business_verification) {
    badges.push({
      key: 'business', icon: 'briefcase-outline',
      label: 'Business verified',
      explanation: 'Ownership or business proof for this property was submitted and checked by our team.',
    });
  }
  if (f.last_audit_outcome === 'pass' && f.days_since_last_audit != null && f.days_since_last_audit <= RECENT_AUDIT_DAYS) {
    badges.push({
      key: 'audited', icon: 'shield-checkmark-outline',
      label: 'Recently audited',
      explanation: `Our team re-checked this listing ${f.days_since_last_audit} days ago and confirmed it still meets our standards.`,
    });
  }
  if (f.days_since_photo_refresh != null && f.days_since_photo_refresh <= FRESH_PHOTO_DAYS) {
    badges.push({
      key: 'photos', icon: 'camera-outline',
      label: 'Fresh photos',
      explanation: `These photos were confirmed current during our team's last visit, ${f.days_since_photo_refresh} days ago.`,
    });
  }
  badges.push({
    key: 'member_since', icon: 'time-outline',
    label: yearsOrMonthsSince(f.created_at),
    explanation: `This listing has been part of TrekRiderz since ${new Date(f.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.`,
  });

  // Response time is deliberately never shown — no response-time tracking
  // exists anywhere in this app today (grep confirms zero response_time/
  // response_rate columns or logic). A prior version of the homestay
  // screen hardcoded "usually within 24 hours," which was fabricated and
  // has been removed rather than reproduced here.

  return badges;
}

export async function fetchRawTrustFactors(entityType: ApprovalEntity, entityId: string): Promise<RawTrustFactors> {
  const { data, error } = await supabase.rpc('compute_partner_trust_factors', { p_entity_type: entityType, p_entity_id: entityId });
  if (error) throw error;
  return data as RawTrustFactors;
}

export async function fetchTrustEvents(entityType: ApprovalEntity, entityId: string): Promise<TrustEvent[]> {
  const { data } = await supabase
    .from('partner_trust_events')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  return (data as TrustEvent[]) || [];
}

// Turns the raw numbers into the partner's checklist. Every item traces
// to one specific RawTrustFactors field — no overall score is derived or
// shown, by design (see file header).
export function interpretForPartner(f: RawTrustFactors): PartnerTrustChecklist {
  const outstandingActions: string[] = [];
  const recommendations: string[] = [];

  const verification: { label: string; done: boolean }[] = [
    { label: 'Identity document submitted', done: f.has_identity_verification },
  ];
  if (f.business_verification_applicable) {
    verification.push({ label: 'Ownership/business proof submitted', done: f.has_business_verification });
  }
  if (!f.has_identity_verification) outstandingActions.push('Submit your identity document.');
  if (f.business_verification_applicable && !f.has_business_verification) outstandingActions.push('Submit ownership/business proof.');

  if (f.overdue_change_requests > 0) outstandingActions.push(`Respond to ${f.overdue_change_requests} requested change(s) open more than ${RESPONSE_OVERDUE_DAYS} days.`);
  else if (f.open_change_requests > 0) outstandingActions.push(`Respond to ${f.open_change_requests} requested change(s).`);

  if (f.document_rejected > 0) outstandingActions.push(`${f.document_rejected} document(s) were rejected — upload a replacement.`);
  if (f.document_expired > 0) outstandingActions.push(`${f.document_expired} document(s) have expired — upload a current version.`);

  let auditStatus: PartnerTrustChecklist['auditStatus'];
  if (f.audit_overdue) {
    auditStatus = { label: `Re-verification overdue since ${f.next_audit_due_date}`, tone: 'attention' };
    outstandingActions.push('Your listing is due for re-verification.');
  } else if (f.audit_count === 0) {
    auditStatus = { label: 'No audit recorded yet', tone: 'warning' };
  } else if (f.next_audit_due_date) {
    auditStatus = { label: `Next audit due ${f.next_audit_due_date}`, tone: 'ok' };
  } else {
    auditStatus = { label: 'Up to date', tone: 'ok' };
  }

  const pendingDocuments: { label: string; count: number }[] = [];
  if (f.document_pending > 0) pendingDocuments.push({ label: 'Awaiting review', count: f.document_pending });
  if (f.document_rejected > 0) pendingDocuments.push({ label: 'Rejected — needs replacement', count: f.document_rejected });
  if (f.document_expired > 0) pendingDocuments.push({ label: 'Expired — needs replacement', count: f.document_expired });

  if (f.profile_completeness_pct < PROFILE_COMPLETE_THRESHOLD) recommendations.push('Complete your profile — add any missing photos, description, or pricing details.');
  if (f.days_since_photo_refresh == null) recommendations.push('Get your photos refreshed at your next audit to keep your listing looking current.');
  if (f.consecutive_clean_audits >= 3) recommendations.push('Great track record — keep up your consecutive clean audits to extend your re-verification interval.');
  if (outstandingActions.length === 0) recommendations.push('You have no outstanding actions right now.');

  return {
    profileCompletionPct: f.profile_completeness_pct,
    verification,
    outstandingActions,
    auditStatus,
    pendingDocuments,
    recommendations,
  };
}
