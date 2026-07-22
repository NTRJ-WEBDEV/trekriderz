import { createClient } from '@/lib/supabase';
import type { ApprovalEntity } from './ApprovalService';

// Internal Trust Engine (Phase 1) — docs/architecture/PARTNER_PLATFORM.md
// §7. NOT the public Trust Score: this stays admin-only (and, for the
// factor-checklist subset, visible to the partner about themselves).
// No traveller ever sees anything from this file, no ranking, no badge.
//
// The raw numbers are computed ONCE, in the database
// (compute_partner_trust_factors, see the migration) — this file only
// formats/explains them. That split is what "avoid duplicate
// calculations" means in practice: mobile's TrustEngineService.ts calls
// the exact same RPC and gets the exact same numbers; only the label
// strings are written twice (mirrored, same convention as every other
// service pair in this codebase).

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

// Raw shape returned by compute_partner_trust_factors — kept 1:1 with
// the SQL function's jsonb_build_object keys, not renamed here, so a
// reader can diff this against the migration directly.
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
  customer_issue_count: null; // framework only — never computed, see migration comment
}

export interface AdminTrustBreakdown {
  overallHealth: { label: 'Excellent' | 'Good' | 'Fair' | 'At Risk'; color: string; summary: string };
  strengths: string[];
  weaknesses: string[];
  missingVerification: string[];
  upcomingRisks: string[];
  expiredDocuments: string[];
  factors: { label: string; value: string; explanation: string }[];
}

// Named thresholds — every one of these is a judgment call worth being
// able to point at and argue with, which is the entire reason they're
// constants with comments instead of bare numbers in the logic below.
const PHOTO_STALE_DAYS = 365; // §7.4: photos >12mo without a passed re-audit degrade quality
const RESPONSE_OVERDUE_DAYS = 14; // matches the review workspace's own "open >14 days" framing already used in the SQL function
const PROFILE_COMPLETE_THRESHOLD = 80; // "substantially complete" bar for a strength callout
const PROFILE_WEAK_THRESHOLD = 50; // below this is called out as a weakness, not just "incomplete"

export async function fetchRawTrustFactors(entityType: ApprovalEntity, entityId: string): Promise<RawTrustFactors> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('compute_partner_trust_factors', { p_entity_type: entityType, p_entity_id: entityId });
  if (error) throw error;
  return data as RawTrustFactors;
}

export async function fetchTrustEvents(entityType: ApprovalEntity, entityId: string): Promise<TrustEvent[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('partner_trust_events')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  return (data as TrustEvent[]) || [];
}

// The one insert path for trust events — mirrors AuditService's
// logAdminAction pattern (one writer, called from the handful of places
// that already own these mutations, not scattered across every caller).
export async function logTrustEvent(
  entityType: ApprovalEntity, entityId: string, eventType: TrustEventType,
  description: string, impact: TrustEventImpact, metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('partner_trust_events').insert({
    entity_type: entityType, entity_id: entityId, event_type: eventType,
    description, impact, actor_id: user?.id ?? null, metadata: metadata ?? {},
  });
  if (error) console.error('TrustEngineService.logTrustEvent failed:', error.message);
}

// The only MANUAL trust event — everything else is emitted automatically
// from the service that already owns that mutation. No automated policy
// detection exists (there's no rules engine to detect a violation), so
// this is deliberately a human, attributed observation, not a fabricated
// automatic signal.
export async function logPolicyViolation(entityType: ApprovalEntity, entityId: string, description: string): Promise<void> {
  await logTrustEvent(entityType, entityId, 'policy_violation', description, 'negative');
}

// Turns the raw numbers into the Admin Trust Panel's sections. Every
// item here traces back to one specific field in RawTrustFactors — if a
// reviewer asks "why does it say this," the answer is always "because
// [field] = [value]," never a black-box weighting.
export function interpretForAdmin(f: RawTrustFactors): AdminTrustBreakdown {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const missingVerification: string[] = [];
  const upcomingRisks: string[] = [];
  const expiredDocuments: string[] = [];

  if (f.profile_completeness_pct >= PROFILE_COMPLETE_THRESHOLD) strengths.push(`Profile is ${f.profile_completeness_pct}% complete.`);
  else if (f.profile_completeness_pct < PROFILE_WEAK_THRESHOLD) weaknesses.push(`Profile is only ${f.profile_completeness_pct}% complete.`);

  if (f.has_identity_verification) strengths.push('Identity document on file.');
  else missingVerification.push('Identity document not submitted.');

  if (f.business_verification_applicable) {
    if (f.has_business_verification) strengths.push('Ownership/business proof on file.');
    else missingVerification.push('Ownership/business proof not submitted.');
  }

  if (f.audit_count === 0) upcomingRisks.push('No audit has ever been recorded for this listing.');
  else if (f.last_audit_outcome === 'pass') strengths.push(`Last audit passed${f.days_since_last_audit != null ? ` (${f.days_since_last_audit} days ago)` : ''}.`);
  else if (f.last_audit_outcome === 'fail') weaknesses.push('Most recent audit failed.');
  else if (f.last_audit_outcome === 'minor_issues') weaknesses.push('Most recent audit found minor issues.');

  if (f.consecutive_clean_audits >= 3) strengths.push(`${f.consecutive_clean_audits} consecutive clean audits.`);
  if (f.audit_overdue) upcomingRisks.push(`Re-verification overdue since ${f.next_audit_due_date}.`);
  else if (f.next_audit_due_date) upcomingRisks.push(`Next audit due ${f.next_audit_due_date}.`);

  if (f.days_since_photo_refresh == null) upcomingRisks.push('Photos have never been refreshed at an audit.');
  else if (f.days_since_photo_refresh > PHOTO_STALE_DAYS) weaknesses.push(`Photos last refreshed ${f.days_since_photo_refresh} days ago (over a year).`);

  if (f.document_expired > 0) expiredDocuments.push(`${f.document_expired} document(s) marked expired.`);
  if (f.document_rejected > 0) weaknesses.push(`${f.document_rejected} document(s) rejected and not yet resolved.`);
  if (f.document_total > 0 && f.document_verified === f.document_total) strengths.push('All submitted documents verified.');

  if (f.overdue_change_requests > 0) weaknesses.push(`${f.overdue_change_requests} requested change(s) open more than ${RESPONSE_OVERDUE_DAYS} days.`);
  else if (f.open_change_requests > 0) upcomingRisks.push(`${f.open_change_requests} requested change(s) currently open.`);

  if (f.policy_violations_recent > 0) weaknesses.push(`${f.policy_violations_recent} policy note(s) logged in the last 6 months.`);
  if (f.suspension_count > 0) weaknesses.push(`Suspended ${f.suspension_count} time(s) historically.`);
  if (f.is_suspended) weaknesses.push('Currently suspended.');

  const riskScore = weaknesses.length * 2 + upcomingRisks.length + (f.is_suspended ? 5 : 0);
  const overallHealth: AdminTrustBreakdown['overallHealth'] =
    f.is_suspended ? { label: 'At Risk', color: '#EF4444', summary: 'Currently suspended.' }
    : riskScore === 0 && strengths.length >= 3 ? { label: 'Excellent', color: '#22C55E', summary: 'Strong verification, clean audit history, no open issues.' }
    : riskScore <= 2 ? { label: 'Good', color: '#8CC63F', summary: 'Generally healthy with minor items to watch.' }
    : riskScore <= 5 ? { label: 'Fair', color: '#F59E0B', summary: 'Several items need attention.' }
    : { label: 'At Risk', color: '#EF4444', summary: 'Multiple unresolved issues — review closely.' };

  return {
    overallHealth, strengths, weaknesses, missingVerification, upcomingRisks, expiredDocuments,
    factors: [
      { label: 'Profile Completeness', value: `${f.profile_completeness_pct}%`, explanation: 'Share of expected profile fields (contact, photos, description, pricing) that are filled in.' },
      { label: 'Documents', value: `${f.document_verified}/${f.document_total} verified`, explanation: `${f.document_pending} pending, ${f.document_rejected} rejected, ${f.document_expired} expired.` },
      { label: 'Audits', value: `${f.audit_count} recorded`, explanation: f.last_audit_outcome ? `Last outcome: ${f.last_audit_outcome.replace('_', ' ')}.` : 'No audit recorded yet.' },
      { label: 'Clean Audit Streak', value: `${f.consecutive_clean_audits}`, explanation: 'Consecutive passing audits — 3+ extends the re-verification cadence.' },
      { label: 'Open Change Requests', value: `${f.open_change_requests}`, explanation: `${f.overdue_change_requests} open more than ${RESPONSE_OVERDUE_DAYS} days.` },
      { label: 'Suspension History', value: `${f.suspension_count} suspension(s), ${f.reinstatement_count} reinstatement(s)`, explanation: 'Counted from logged account_suspended/account_reinstated trust events.' },
      { label: 'Customer Issues', value: 'Not yet tracked', explanation: 'No automated customer-issue-report pipeline exists yet — framework only, per design.' },
    ],
  };
}
