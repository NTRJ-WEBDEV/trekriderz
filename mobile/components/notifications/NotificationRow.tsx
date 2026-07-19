import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupedNotification, formatRelativeTime } from '@/lib/notifications/grouping';
import { getTypeConfig } from '@/lib/notifications/registry';
import { PostMeta } from '@/hooks/useNotifications';
import Button from '@/components/ui/Button';

interface Props {
  item: GroupedNotification;
  postMeta: Record<string, PostMeta>;
  followingSet: Set<string>;
  actionLoading: string | null;
  onPress: () => void;
  onFollowRequest: (action: 'accepted' | 'declined') => void;
  onTripInvite: (action: 'accepted' | 'declined') => void;
  onFollowBack: () => void;
}

export default function NotificationRow({
  item, postMeta, followingSet, actionLoading, onPress, onFollowRequest, onTripInvite, onFollowBack,
}: Props) {
  const cfg = getTypeConfig(item.type);
  const isBusy = actionLoading === item.id;
  const postId = item.related_id || item.metadata?.post_id;
  const meta = postId ? postMeta[postId] : undefined;
  const hasAvatar = !!item.users?.avatar_url;

  let actionKind = cfg.getActionKind(item, { amFollowing: (id) => followingSet.has(id) });
  // followBack is suppressed once already following — not a distinct
  // registry-level concept, just a live check against fetched state.
  if (actionKind === 'followBack' && item.sender_id && followingSet.has(item.sender_id)) {
    actionKind = 'none';
  }

  const displayText = item.groupText
    ? (
      <Text style={styles.content}>
        <Text style={styles.senderName}>{item.senderNames[0]}</Text>
        {`, `}
        <Text style={styles.senderName}>{item.senderNames[1]}</Text>
        {` and ${item.senderNames.length - 2} other${item.senderNames.length - 2 > 1 ? 's' : ''} ${cfg.groupVerb}`}
      </Text>
    )
    : (
      <Text style={styles.content} numberOfLines={item.type === 'trip_invite' ? undefined : 2}>
        <Text style={styles.senderName}>{item.users?.full_name || 'TrekRiderz'}</Text>
        {'  '}{item.message}
      </Text>
    );

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.row, !item.is_read && styles.unread]}
    >
      {!item.is_read && <View style={styles.unreadDot} />}

      {hasAvatar ? (
        <Image source={{ uri: item.users!.avatar_url! }} style={styles.avatar} />
      ) : (
        <View style={[styles.iconContainer, { backgroundColor: cfg.color + '20' }]}>
          <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
        </View>
      )}

      <View style={styles.body}>
        {displayText}
        <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>

        {actionKind === 'followRequest' && !item.is_read && (
          <View style={styles.actionRow}>
            <Button label="Accept" size="sm" loading={isBusy} onPress={() => onFollowRequest('accepted')} style={styles.actionBtnWidth} />
            <Button label="Decline" size="sm" variant="outline" disabled={isBusy} onPress={() => onFollowRequest('declined')} style={styles.actionBtnWidth} />
          </View>
        )}

        {actionKind === 'followBack' && (
          <View style={styles.actionRow}>
            <Button label="Follow Back" size="sm" loading={isBusy} onPress={onFollowBack} />
          </View>
        )}

        {actionKind === 'tripInvite' && !item.is_read && (
          <View style={styles.actionRow}>
            <Button label="Accept" size="sm" loading={isBusy} onPress={() => onTripInvite('accepted')} style={styles.actionBtnWidth} />
            <Button label="Decline" size="sm" variant="outline" disabled={isBusy} onPress={() => onTripInvite('declined')} style={styles.actionBtnWidth} />
          </View>
        )}

        {actionKind === 'view' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.btn, styles.viewBtn]} onPress={onPress}>
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {meta?.thumbnail && (
        <Image source={{ uri: meta.thumbnail }} style={styles.thumbnail} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
    gap: 12,
  },
  unread: {
    backgroundColor: 'rgba(140,198,63,0.05)',
  },
  unreadDot: {
    position: 'absolute',
    left: 5,
    top: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8CC63F',
    marginTop: -3,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    flexShrink: 0,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
  },
  content: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  senderName: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  time: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  actionBtnWidth: {
    minWidth: 90,
  },
  viewBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  viewBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
    flexShrink: 0,
  },
});
