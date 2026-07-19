import { AppNotification, getTypeConfig } from './registry';

export interface GroupedNotification extends AppNotification {
  ids: string[]; // every underlying notification id this row represents (for mark-read)
  senderNames: string[]; // in the order encountered (most recent first)
  groupText: string | null; // pre-formatted "X, Y and N others <verb>" when grouped.length > 1
}

// Same-type, same-target (post), same-calendar-day notifications collapse
// into one row — mirrors Instagram's "Rahul, Priya and 18 others liked your
// post" instead of one row per like. Order is preserved from the input
// (expected to already be created_at desc), so a group appears at the
// position of its most recent member.
export function groupNotifications(raw: AppNotification[]): GroupedNotification[] {
  const groupIndex = new Map<string, GroupedNotification>();
  const result: GroupedNotification[] = [];

  for (const n of raw) {
    const cfg = getTypeConfig(n.type);
    const targetId = n.related_id || n.metadata?.post_id;
    const key = cfg.groupable && targetId
      ? `${n.type}:${targetId}:${new Date(n.created_at).toDateString()}`
      : null;

    const existing = key ? groupIndex.get(key) : undefined;
    if (existing) {
      existing.ids.push(n.id);
      existing.is_read = existing.is_read && n.is_read;
      if (n.users?.full_name) existing.senderNames.push(n.users.full_name);
      existing.groupText = formatGroupText(existing.senderNames, cfg.groupVerb);
      continue;
    }

    const grouped: GroupedNotification = {
      ...n,
      ids: [n.id],
      senderNames: n.users?.full_name ? [n.users.full_name] : [],
      groupText: null,
    };
    result.push(grouped);
    if (key) groupIndex.set(key, grouped);
  }

  return result;
}

function formatGroupText(names: string[], verb?: string): string | null {
  if (names.length <= 1 || !verb) return null;
  if (names.length === 2) return `${names[0]} and ${names[1]} ${verb}`;
  const extra = names.length - 2;
  return `${names[0]}, ${names[1]} and ${extra} other${extra > 1 ? 's' : ''} ${verb}`;
}

export type NotificationSection = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

export function getSection(dateStr: string): NotificationSection {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (d >= startOfToday) return 'Today';
  if (d >= startOfYesterday) return 'Yesterday';
  if (d >= startOfWeek) return 'This Week';
  return 'Earlier';
}

const SECTION_ORDER: NotificationSection[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];

export type SectionedItem =
  | { kind: 'header'; id: string; label: NotificationSection }
  | { kind: 'item'; id: string; notification: GroupedNotification };

// Flat array (header rows interleaved with item rows) so the FlatList stays
// a single list — no nested SectionList complexity, consistent with how
// this screen already worked before the redesign.
export function sectionNotifications(items: GroupedNotification[]): SectionedItem[] {
  const buckets: Record<NotificationSection, GroupedNotification[]> = {
    Today: [], Yesterday: [], 'This Week': [], Earlier: [],
  };
  for (const item of items) buckets[getSection(item.created_at)].push(item);

  const out: SectionedItem[] = [];
  for (const section of SECTION_ORDER) {
    const bucket = buckets[section];
    if (bucket.length === 0) continue;
    out.push({ kind: 'header', id: `header-${section}`, label: section });
    for (const n of bucket) out.push({ kind: 'item', id: n.id, notification: n });
  }
  return out;
}

export function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
