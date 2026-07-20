import { createSupabaseServer } from '@/lib/supabase-server';
import type { RewardCampaign, RewardCandidate } from './RewardEngineService';

// All bounded aggregate queries for the /admin dashboard homepage live
// here — one place, easy to extend — rather than inline in the page or
// scattered across dashboard components. Every function takes the
// caller's `hasPermission` check and skips its own query entirely when
// the signed-in staff member can't see that data, so a narrowly-scoped
// role never fires queries for sections it won't render.

export type Urgency = 'high' | 'medium' | 'low';

export interface InboxCard {
  key: string;
  label: string;
  count: number;
  urgency: Urgency;
  description: string;
  href: string;
}

export interface KPI {
  key: string;
  label: string;
  value: number;
  delta: number | null; // vs. previous day; null when not tracked
  href?: string;
}

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

export interface UpcomingExpedition {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  max_seats: number;
  booked_seats: number;
  status: string;
  guide_name: string | null;
  warnings: string[];
}

export interface EnquiryRow {
  id: string;
  source: 'trip' | 'custom';
  name: string;
  related: string | null;
  contact: string | null;
  status: string;
  created_at: string;
}

export interface CommunityHealth {
  postsToday: number;
  reelsToday: number;
  commentsToday: number;
  reportedContentCount: number;
  hiddenContentCount: number;
  bannedUsersCount: number;
  activeCommunitiesCount: number;
  topCreators: { user_id: string; full_name: string | null; post_count: number }[];
}

export interface SystemHealth {
  supabaseOk: boolean;
  storageOk: boolean;
  realtimeOk: boolean;
  envWarnings: string[];
  deployment: { commit: string | null; env: string | null };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfYesterday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - 1);
  return d;
}
function startOfWeek(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - 7);
  return d;
}

async function headCount(
  supabase: any,
  table: string,
  build: (q: any) => any
): Promise<number> {
  const { count } = await build(supabase.from(table).select('id', { count: 'exact', head: true }));
  return count || 0;
}

export async function getOperationsInbox(hasPermission: (key: string) => boolean): Promise<InboxCard[]> {
  const supabase = await createSupabaseServer();
  const jobs: Promise<InboxCard | null>[] = [];

  if (hasPermission('guides.approve')) {
    jobs.push(
      headCount(supabase, 'guides', (q) => q.eq('status', 'pending')).then((count) => ({
        key: 'guides', label: 'Pending Guides', count, urgency: count > 0 ? 'medium' : 'low',
        description: 'Guide profiles awaiting verification.', href: '/admin/guides',
      } as InboxCard))
    );
  }
  if (hasPermission('homestays.approve')) {
    jobs.push(
      headCount(supabase, 'properties', (q) => q.eq('status', 'pending')).then((count) => ({
        key: 'homestays', label: 'Pending Homestays', count, urgency: count > 0 ? 'medium' : 'low',
        description: 'Property listings awaiting verification.', href: '/admin/homestays',
      } as InboxCard))
    );
  }
  if (hasPermission('rentals.approve')) {
    jobs.push(
      headCount(supabase, 'rental_vehicles', (q) => q.eq('status', 'pending')).then((count) => ({
        key: 'rentals', label: 'Pending Vehicles', count, urgency: count > 0 ? 'medium' : 'low',
        description: 'Rental listings awaiting verification.', href: '/admin/rentals',
      } as InboxCard))
    );
  }
  if (hasPermission('expeditions.manage')) {
    jobs.push(
      headCount(supabase, 'guided_expeditions', (q) => q.eq('status', 'draft')).then((count) => ({
        key: 'expeditions', label: 'Draft Expeditions', count, urgency: 'low',
        description: 'Expeditions not yet published.', href: '/admin/expeditions',
      } as InboxCard))
    );
  }
  if (hasPermission('reports.resolve')) {
    jobs.push(
      Promise.all([
        headCount(supabase, 'post_reports', (q) => q.eq('status', 'pending')),
        headCount(supabase, 'content_reports', (q) => q.eq('status', 'pending')),
      ]).then(([a, b]) => ({
        key: 'reports', label: 'Open Reports', count: a + b, urgency: a + b > 0 ? 'high' : 'low',
        description: 'Reported posts, comments, and stories awaiting review.', href: '/admin/reports',
      } as InboxCard))
    );
  }
  if (hasPermission('trips.view')) {
    jobs.push(
      Promise.all([
        headCount(supabase, 'enquiries', (q) => q.eq('status', 'new')),
        headCount(supabase, 'custom_enquiries', (q) => q.eq('status', 'new')),
      ]).then(([a, b]) => ({
        key: 'enquiries', label: 'Unread Enquiries', count: a + b, urgency: a + b > 0 ? 'medium' : 'low',
        description: 'Trip and custom enquiries not yet contacted.', href: '/admin/enquiries',
      } as InboxCard))
    );
  }
  if (hasPermission('bookings.view')) {
    jobs.push(
      headCount(supabase, 'bookings', (q) => q.eq('status', 'pending').eq('payment_status', 'unpaid')).then((count) => ({
        key: 'bookings', label: 'Incomplete Bookings', count, urgency: count > 0 ? 'medium' : 'low',
        description: 'Bookings pending with no payment received.', href: '/admin/trips',
      } as InboxCard))
    );
  }
  if (hasPermission('sos.manage')) {
    jobs.push(
      headCount(supabase, 'sos_alerts', (q) => q.eq('status', 'active')).then((count) => ({
        key: 'sos', label: 'Unresolved SOS Alerts', count, urgency: count > 0 ? 'high' : 'low',
        description: 'Active safety alerts raised on trips.', href: '/admin/sos',
      } as InboxCard))
    );
  }
  if (hasPermission('communities.manage')) {
    jobs.push(
      headCount(supabase, 'communities', (q) => q.eq('is_suspended', true)).then((count) => ({
        key: 'communities', label: 'Suspended Communities', count, urgency: 'low',
        description: 'Communities currently suspended.', href: '/admin/communities',
      } as InboxCard))
    );
  }
  if (hasPermission('guides.approve') || hasPermission('homestays.approve') || hasPermission('rentals.approve')) {
    jobs.push(
      Promise.all([
        hasPermission('guides.approve')
          ? headCount(supabase, 'guides', (q) => q.eq('status', 'pending').is('profile_photo_url', null).is('photo_url', null))
          : Promise.resolve(0),
        hasPermission('homestays.approve')
          ? headCount(supabase, 'properties', (q) => q.eq('status', 'pending').is('cover_photo_url', null))
          : Promise.resolve(0),
        hasPermission('rentals.approve')
          ? headCount(supabase, 'rental_vehicles', (q) => q.eq('status', 'pending').is('photos', null))
          : Promise.resolve(0),
      ]).then(([g, p, r]) => (g + p + r > 0 ? {
        key: 'missing_info', label: 'Listings Missing Photos', count: g + p + r, urgency: 'low',
        description: 'Pending guide/homestay/rental listings with no photo uploaded.', href: '/admin/guides',
      } as InboxCard : null))
    );
  }

  const results = await Promise.all(jobs);
  return results.filter((r): r is InboxCard => !!r);
}

export async function getTodayKpis(hasPermission: (key: string) => boolean): Promise<KPI[]> {
  const supabase = await createSupabaseServer();
  const todayIso = startOfToday().toISOString();
  const yesterdayIso = startOfYesterday().toISOString();
  const kpis: KPI[] = [];

  async function dayOverDay(table: string, build: (q: any, from: string, to?: string) => any): Promise<[number, number]> {
    const [today, yesterday] = await Promise.all([
      headCount(supabase, table, (q) => build(q, todayIso)),
      headCount(supabase, table, (q) => build(q, yesterdayIso, todayIso)),
    ]);
    return [today, yesterday];
  }

  if (hasPermission('users.view')) {
    const [today, yesterday] = await dayOverDay('users', (q, from, to) =>
      to ? q.gte('created_at', from).lt('created_at', to) : q.gte('created_at', from));
    kpis.push({ key: 'new_users', label: 'New Users', value: today, delta: today - yesterday, href: '/admin/users' });

    const todayStr = todayIso.split('T')[0];
    const { data: activeRows } = await supabase.from('user_daily_activity').select('user_id').eq('activity_date', todayStr);
    const activeCount = new Set((activeRows || []).map((r: any) => r.user_id)).size;
    kpis.push({ key: 'active_users', label: 'Active Users', value: activeCount, delta: null, href: '/admin/users' });
  }

  if (hasPermission('posts.delete') || hasPermission('reels.moderate')) {
    const [postsToday, postsYesterday] = await dayOverDay('posts', (q, from, to) => {
      const filtered = q.is('post_type', null).gte('created_at', from);
      return to ? filtered.lt('created_at', to) : filtered;
    });
    kpis.push({ key: 'posts', label: 'Posts', value: postsToday, delta: postsToday - postsYesterday, href: '/admin/moderation' });

    const [reelsToday, reelsYesterday] = await dayOverDay('posts', (q, from, to) => {
      const filtered = q.eq('post_type', 'reel').gte('created_at', from);
      return to ? filtered.lt('created_at', to) : filtered;
    });
    kpis.push({ key: 'reels', label: 'Reels', value: reelsToday, delta: reelsToday - reelsYesterday, href: '/admin/moderation' });
  }

  if (hasPermission('stories.moderate')) {
    const [storiesToday, storiesYesterday] = await dayOverDay('stories_24h', (q, from, to) => {
      const filtered = q.gte('created_at', from);
      return to ? filtered.lt('created_at', to) : filtered;
    });
    kpis.push({ key: 'stories', label: 'Stories', value: storiesToday, delta: storiesToday - storiesYesterday, href: '/admin/stories' });
  }

  if (hasPermission('trips.view')) {
    const [enqToday, enqYesterday] = await Promise.all([
      Promise.all([
        headCount(supabase, 'enquiries', (q) => q.gte('created_at', todayIso)),
        headCount(supabase, 'custom_enquiries', (q) => q.gte('created_at', todayIso)),
      ]).then(([a, b]) => a + b),
      Promise.all([
        headCount(supabase, 'enquiries', (q) => q.gte('created_at', yesterdayIso).lt('created_at', todayIso)),
        headCount(supabase, 'custom_enquiries', (q) => q.gte('created_at', yesterdayIso).lt('created_at', todayIso)),
      ]).then(([a, b]) => a + b),
    ]);
    kpis.push({ key: 'enquiries', label: 'New Enquiries', value: enqToday, delta: enqToday - enqYesterday, href: '/admin/enquiries' });
  }

  if (hasPermission('bookings.view')) {
    const [bookingsToday, bookingsYesterday] = await dayOverDay('bookings', (q, from, to) => {
      const filtered = q.gte('created_at', from);
      return to ? filtered.lt('created_at', to) : filtered;
    });
    kpis.push({ key: 'bookings', label: 'New Bookings', value: bookingsToday, delta: bookingsToday - bookingsYesterday, href: '/admin/trips' });
  }

  if (hasPermission('expeditions.manage')) {
    const upcoming = await headCount(supabase, 'guided_expeditions', (q) =>
      q.eq('status', 'published').gte('start_date', new Date().toISOString()));
    kpis.push({ key: 'upcoming_trips', label: 'Upcoming Trips', value: upcoming, delta: null, href: '/admin/expeditions' });
  }

  if (hasPermission('reports.resolve')) {
    const [a, b] = await Promise.all([
      headCount(supabase, 'post_reports', (q) => q.gte('created_at', todayIso)),
      headCount(supabase, 'content_reports', (q) => q.gte('created_at', todayIso)),
    ]);
    kpis.push({ key: 'reports_today', label: 'Reports Received', value: a + b, delta: null, href: '/admin/reports' });
  }

  return kpis;
}

export async function getRecentActivity(hasPermission: (key: string) => boolean, limit = 20): Promise<ActivityLogRow[]> {
  if (!hasPermission('activity_log.view')) return [];
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from('admin_activity_log').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data as ActivityLogRow[]) || [];
}

export async function getUpcomingOperations(hasPermission: (key: string) => boolean, horizonDays = 7, limit = 6): Promise<UpcomingExpedition[]> {
  if (!hasPermission('expeditions.manage') && !hasPermission('trips.view')) return [];
  const supabase = await createSupabaseServer();
  const now = new Date();
  const horizon = new Date(now.getTime() + horizonDays * 86400000);
  const { data } = await supabase
    .from('guided_expeditions')
    .select('id, title, start_date, end_date, max_seats, booked_seats, status, guide_id, guides:guide_id(full_name, name)')
    .eq('status', 'published')
    .gte('start_date', now.toISOString())
    .lte('start_date', horizon.toISOString())
    .order('start_date', { ascending: true })
    .limit(limit);

  return ((data as any[]) || []).map((e) => {
    const warnings: string[] = [];
    const seatsLeft = (e.max_seats || 0) - (e.booked_seats || 0);
    if (seatsLeft <= 0) warnings.push('No seats left');
    if (!e.guide_id) warnings.push('Guide not assigned');
    return {
      id: e.id, title: e.title, start_date: e.start_date, end_date: e.end_date,
      max_seats: e.max_seats, booked_seats: e.booked_seats, status: e.status,
      guide_name: e.guides?.full_name || e.guides?.name || null,
      warnings,
    } as UpcomingExpedition;
  });
}

export async function getRecentEnquiries(hasPermission: (key: string) => boolean, limit = 8): Promise<EnquiryRow[]> {
  if (!hasPermission('trips.view')) return [];
  const supabase = await createSupabaseServer();
  const [{ data: trip }, { data: custom }] = await Promise.all([
    supabase.from('enquiries').select('id, name, trip_name, email, whatsapp, status, created_at').order('created_at', { ascending: false }).limit(limit),
    supabase.from('custom_enquiries').select('id, name, destination_type, email, whatsapp, status, created_at').order('created_at', { ascending: false }).limit(limit),
  ]);

  const rows: EnquiryRow[] = [
    ...((trip as any[]) || []).map((r) => ({
      id: r.id, source: 'trip' as const, name: r.name, related: r.trip_name, contact: r.email || r.whatsapp, status: r.status, created_at: r.created_at,
    })),
    ...((custom as any[]) || []).map((r) => ({
      id: r.id, source: 'custom' as const, name: r.name, related: r.destination_type, contact: r.email || r.whatsapp, status: r.status, created_at: r.created_at,
    })),
  ];
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function getCommunityHealth(hasPermission: (key: string) => boolean): Promise<CommunityHealth | null> {
  if (!hasPermission('posts.delete') && !hasPermission('comments.moderate')) return null;
  const supabase = await createSupabaseServer();
  const todayIso = startOfToday().toISOString();
  const weekIso = startOfWeek().toISOString();

  const [postsToday, reelsToday, commentsToday, reportedContentCount, hiddenCommentsCount, hiddenStoriesCount, bannedUsersCount, activeCommunitiesCount, recentPosts] =
    await Promise.all([
      headCount(supabase, 'posts', (q) => q.is('post_type', null).gte('created_at', todayIso)),
      headCount(supabase, 'posts', (q) => q.eq('post_type', 'reel').gte('created_at', todayIso)),
      headCount(supabase, 'post_comments', (q) => q.gte('created_at', todayIso)),
      Promise.all([
        headCount(supabase, 'post_reports', (q) => q.eq('status', 'pending')),
        headCount(supabase, 'content_reports', (q) => q.eq('status', 'pending')),
      ]).then(([a, b]) => a + b),
      headCount(supabase, 'post_comments', (q) => q.eq('is_hidden', true)),
      headCount(supabase, 'stories_24h', (q) => q.eq('is_hidden', true)),
      headCount(supabase, 'users', (q) => q.eq('is_banned', true)),
      headCount(supabase, 'communities', (q) => q.eq('is_suspended', false)),
      supabase.from('posts').select('user_id, users:user_id(full_name)').gte('created_at', weekIso).limit(500),
    ]);

  const creatorCounts: Record<string, { full_name: string | null; count: number }> = {};
  ((recentPosts.data as any[]) || []).forEach((p) => {
    const key = p.user_id;
    if (!creatorCounts[key]) creatorCounts[key] = { full_name: p.users?.full_name ?? null, count: 0 };
    creatorCounts[key].count++;
  });
  const topCreators = Object.entries(creatorCounts)
    .map(([user_id, v]) => ({ user_id, full_name: v.full_name, post_count: v.count }))
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, 5);

  return {
    postsToday, reelsToday, commentsToday, reportedContentCount,
    hiddenContentCount: hiddenCommentsCount + hiddenStoriesCount,
    bannedUsersCount, activeCommunitiesCount, topCreators,
  };
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const supabase = await createSupabaseServer();
  let supabaseOk = false;
  try {
    const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' }).limit(1);
    supabaseOk = !error;
  } catch { supabaseOk = false; }

  let storageOk = false;
  try {
    const { error } = await supabase.storage.listBuckets();
    storageOk = !error;
  } catch { storageOk = false; }

  const envWarnings: string[] = [];
  if (!process.env.RAZORPAY_KEY_SECRET) envWarnings.push('RAZORPAY_KEY_SECRET not set');
  if (!process.env.OPENWEATHER_API_KEY) envWarnings.push('OPENWEATHER_API_KEY not set');
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) envWarnings.push('No AI trip planner key configured');

  return {
    supabaseOk,
    storageOk,
    realtimeOk: supabaseOk, // no separate realtime handshake performed server-side; mirrors DB reachability
    envWarnings,
    deployment: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
      env: process.env.VERCEL_ENV || null,
    },
  };
}

// Small, dashboard-specific preview of the generic reward engine (see
// RewardEngineService.ts) — a bounded top-5 read, not a second engine.
// Uses the server Supabase client since this runs inside the Server
// Component page; RewardEngineService itself stays browser-client-based
// for the interactive /admin/community-champions page.
export async function getChampionsPreview(
  hasPermission: (key: string) => boolean
): Promise<{ campaign: RewardCampaign | null; candidates: RewardCandidate[] }> {
  if (!hasPermission('reward_campaigns.view')) return { campaign: null, candidates: [] };
  const supabase = await createSupabaseServer();

  const { data: campaign } = await supabase
    .from('reward_campaigns')
    .select('*')
    .eq('campaign_type', 'community_champions')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!campaign) return { campaign: null, candidates: [] };

  const { data: candidateRows } = await supabase
    .from('reward_candidates')
    .select('*, users:user_id(full_name, email, avatar_url)')
    .eq('campaign_id', campaign.id)
    .order('activity_score', { ascending: false })
    .limit(5);

  const candidates = ((candidateRows as any[]) || []).map((r) => ({
    ...r,
    full_name: r.users?.full_name ?? null,
    email: r.users?.email ?? null,
    avatar_url: r.users?.avatar_url ?? null,
    last_active: null,
  })) as RewardCandidate[];

  return { campaign: campaign as RewardCampaign, candidates };
}
