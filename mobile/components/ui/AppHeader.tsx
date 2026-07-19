import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppColors, Spacing } from '@/constants/theme';
import Wordmark from '@/components/ui/Wordmark';

interface Props {
  avatarUrl: string;
  notificationCount: number;
  chatCount: number;
}

// Shared top bar — avatar left / wordmark center / notification+chat right,
// both with unread badges. Used identically across all 4 bottom tabs (Feed,
// Adventure, Community, Chat) — one header, not a per-screen reimplementation.
export default function AppHeader({ avatarUrl, notificationCount, chatCount }: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)}>
        <View style={styles.avatarWrap}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <View style={styles.onlineDot} />
        </View>
      </TouchableOpacity>

      <View style={styles.logoWrap} pointerEvents="none">
        <Wordmark size="sm" tagline />
      </View>

      <View style={styles.rightIcons}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/notifications' as any)} hitSlop={6}>
          <Ionicons name="notifications-outline" size={24} color={AppColors.text} />
          {notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/chats' as any)} hitSlop={6}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={AppColors.text} />
          {chatCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{chatCount > 9 ? '9+' : chatCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    position: 'relative',
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: AppColors.primary,
    borderWidth: 2,
    borderColor: AppColors.background,
  },
  logoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rightIcons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  iconBtn: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ED4956',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: AppColors.background,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
