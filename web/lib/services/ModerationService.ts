import { createClient } from '@/lib/supabase';
import { notify } from './NotificationService';
import { logAdminAction } from './AuditService';

// The shared implementation the Content Moderation panel and Reports
// Center both call through — hide/restore/delete/warn/suspend/ban logic
// lives here once instead of once per content type per screen.
export type ModeratableEntity = 'posts' | 'stories_24h' | 'post_comments';

interface ModerationConfig {
  table: string;
  mode: 'boolean' | 'status';
  hiddenField: string;
  reasonField: string;
  ownerField: string;
  hiddenValue?: string;
  visibleValue?: string;
}

// posts uses a moderation_status text column; stories_24h and post_comments
// use a plain is_hidden boolean — real schema differences, not a design
// choice, so the service branches on `mode` rather than forcing one shape.
const CONFIG: Record<ModeratableEntity, ModerationConfig> = {
  posts: { table: 'posts', mode: 'status', hiddenField: 'moderation_status', reasonField: 'moderation_reason', ownerField: 'user_id', hiddenValue: 'hidden', visibleValue: 'active' },
  stories_24h: { table: 'stories_24h', mode: 'boolean', hiddenField: 'is_hidden', reasonField: 'moderation_reason', ownerField: 'user_id' },
  post_comments: { table: 'post_comments', mode: 'boolean', hiddenField: 'is_hidden', reasonField: 'hidden_reason', ownerField: 'user_id' },
};

export async function hideContent(entity: ModeratableEntity, id: string, reason: string): Promise<void> {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  const payload: Record<string, unknown> = { [cfg.reasonField]: reason, [cfg.hiddenField]: cfg.mode === 'boolean' ? true : cfg.hiddenValue };
  const { error } = await supabase.from(cfg.table).update(payload).eq('id', id);
  if (error) throw error;
  await logAdminAction({ action: `${entity}.hidden`, entityType: entity, entityId: id, reason });
}

export async function restoreContent(entity: ModeratableEntity, id: string): Promise<void> {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  const payload: Record<string, unknown> = { [cfg.hiddenField]: cfg.mode === 'boolean' ? false : cfg.visibleValue };
  const { error } = await supabase.from(cfg.table).update(payload).eq('id', id);
  if (error) throw error;
  await logAdminAction({ action: `${entity}.restored`, entityType: entity, entityId: id });
}

export async function deleteContent(entity: ModeratableEntity, id: string, previousValue?: unknown): Promise<void> {
  const cfg = CONFIG[entity];
  const supabase = createClient();
  const { error } = await supabase.from(cfg.table).delete().eq('id', id);
  if (error) throw error;
  await logAdminAction({ action: `${entity}.deleted`, entityType: entity, entityId: id, previousValue });
}

export async function warnUser(userId: string, reason: string): Promise<void> {
  const supabase = createClient();
  const { data: user } = await supabase.from('users').select('warning_count').eq('id', userId).single();
  const newCount = (user?.warning_count || 0) + 1;
  await supabase.from('users').update({ warning_count: newCount }).eq('id', userId);
  await notify({ userId, type: 'other', title: 'Content Warning', message: reason });
  await logAdminAction({ action: 'user.warned', entityType: 'user', entityId: userId, reason, newValue: { warning_count: newCount } });
}

export async function resetWarnings(userId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('users').update({ warning_count: 0 }).eq('id', userId);
  await logAdminAction({ action: 'user.warnings_reset', entityType: 'user', entityId: userId, newValue: { warning_count: 0 } });
}

export async function suspendUser(userId: string, reason: string, days = 7): Promise<void> {
  const supabase = createClient();
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  await supabase.from('users').update({ is_banned: true, ban_reason: reason, ban_expires_at: expiresAt }).eq('id', userId);
  await notify({ userId, type: 'other', title: 'Account Suspended', message: reason });
  await logAdminAction({ action: 'user.suspended', entityType: 'user', entityId: userId, reason, newValue: { is_banned: true, ban_expires_at: expiresAt } });
}

export async function banUser(userId: string, reason: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('users').update({ is_banned: true, ban_reason: reason, ban_expires_at: null }).eq('id', userId);
  await notify({ userId, type: 'other', title: 'Account Banned', message: reason });
  await logAdminAction({ action: 'user.banned', entityType: 'user', entityId: userId, reason, newValue: { is_banned: true, ban_expires_at: null } });
}

export async function unbanUser(userId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('users').update({ is_banned: false, ban_reason: null, ban_expires_at: null }).eq('id', userId);
  await notify({ userId, type: 'other', title: 'Account Restored', message: 'Your account access has been restored.' });
  await logAdminAction({ action: 'user.unbanned', entityType: 'user', entityId: userId });
}
