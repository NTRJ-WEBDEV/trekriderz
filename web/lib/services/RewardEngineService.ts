import { createClient } from '@/lib/supabase';
import { logAdminAction } from './AuditService';

// Generic reward-campaign engine — NOT specific to "Community Champions".
// Any future admin surface (Partner Dashboard, Finance, Marketplace,
// Mobile Admin) reads/writes the same reward_campaigns/reward_candidates
// tables through this one service instead of building a parallel one.
// Community Champions (web/app/admin/community-champions) is just its
// first consumer.

export type CandidateStatus = 'eligible' | 'shortlisted' | 'approved' | 'rewarded' | 'disqualified';

export interface RewardItem {
  type: string;
  label: string;
  value?: string;
}

export interface RewardCampaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  reward_items: RewardItem[];
  scoring_weights: Record<string, number>;
  min_active_days: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface RewardCandidate {
  id: string;
  campaign_id: string;
  user_id: string;
  activity_score: number;
  active_days: number;
  posts_count: number;
  reels_count: number;
  stories_count: number;
  comments_count: number;
  likes_given_count: number;
  status: CandidateStatus;
  internal_note: string | null;
  computed_at: string | null;
  decided_at: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  last_active: string | null;
}

export async function fetchCampaigns(): Promise<RewardCampaign[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('reward_campaigns').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as RewardCampaign[]) || [];
}

export async function fetchCandidates(
  campaignId: string,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {}
): Promise<{ rows: RewardCandidate[]; total: number }> {
  const supabase = createClient();
  const { data, count, error } = await supabase
    .from('reward_candidates')
    .select('*, users:user_id(full_name, email, avatar_url)', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('activity_score', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;

  const rows = (data as any[]) || [];
  const ids = rows.map((r) => r.user_id);
  const { data: activityRows } = ids.length
    ? await supabase.from('user_daily_activity').select('user_id, activity_date').in('user_id', ids)
    : { data: [] as any[] };
  const lastActiveMap: Record<string, string> = {};
  (activityRows || []).forEach((a: any) => {
    if (!lastActiveMap[a.user_id] || a.activity_date > lastActiveMap[a.user_id]) lastActiveMap[a.user_id] = a.activity_date;
  });

  return {
    rows: rows.map((r) => ({
      ...r,
      full_name: r.users?.full_name ?? null,
      email: r.users?.email ?? null,
      avatar_url: r.users?.avatar_url ?? null,
      last_active: lastActiveMap[r.user_id] || null,
    })),
    total: count || 0,
  };
}

export async function recalculateScores(campaignId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('compute_reward_campaign_scores', { p_campaign_id: campaignId });
  if (error) throw error;
  await logAdminAction({ action: 'reward_campaigns.recalculated', entityType: 'reward_campaign', entityId: campaignId, newValue: { candidates_updated: data } });
  return data as number;
}

export async function setCandidateStatus(candidateId: string, status: CandidateStatus, note?: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const update: Record<string, unknown> = { status, decided_at: new Date().toISOString(), decided_by: user?.id ?? null };
  if (note !== undefined) update.internal_note = note;
  const { error } = await supabase.from('reward_candidates').update(update).eq('id', candidateId);
  if (error) throw error;
  await logAdminAction({ action: 'reward_campaigns.status_changed', entityType: 'reward_candidate', entityId: candidateId, reason: note, newValue: { status } });
}

export async function addCandidateNote(candidateId: string, note: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('reward_candidates').update({ internal_note: note }).eq('id', candidateId);
  if (error) throw error;
  await logAdminAction({ action: 'reward_campaigns.note_added', entityType: 'reward_candidate', entityId: candidateId, reason: note });
}

export function candidatesToCsv(rows: RewardCandidate[]): string {
  const header = ['Rank', 'Name', 'Email', 'Status', 'Score', 'Active Days', 'Posts', 'Reels', 'Stories', 'Comments', 'Likes Given', 'Last Active'];
  const lines = rows.map((r, i) => [
    i + 1, r.full_name || 'Unnamed', r.email || '', r.status, r.activity_score, r.active_days,
    r.posts_count, r.reels_count, r.stories_count, r.comments_count, r.likes_given_count, r.last_active || '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...lines].join('\n');
}
