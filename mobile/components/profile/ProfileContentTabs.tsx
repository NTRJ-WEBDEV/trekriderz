import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing } from '@/constants/theme';
import PostsGrid from './PostsGrid';

type Tab = 'posts' | 'stories' | 'reels' | 'tagged';

const TABS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; enabled: boolean }[] = [
  { key: 'posts', icon: 'grid-outline', enabled: true },
  { key: 'stories', icon: 'book-outline', enabled: true },
  { key: 'reels', icon: 'play-circle-outline', enabled: false },
  { key: 'tagged', icon: 'pricetag-outline', enabled: false },
];

interface Props {
  userId: string;
}

// Posts + Travel Stories are live today. Reels and Tagged are reserved
// tab slots for features with no backend yet — visible (so the tab bar's
// final shape is already in place) but disabled rather than hidden.
export default function ProfileContentTabs({ userId }: Props) {
  const [active, setActive] = useState<Tab>('posts');

  return (
    <View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, active === tab.key && styles.tabBtnActive]}
            onPress={() => tab.enabled && setActive(tab.key)}
            activeOpacity={tab.enabled ? 0.7 : 1}
          >
            <Ionicons
              name={tab.icon}
              size={22}
              color={!tab.enabled ? 'rgba(255,255,255,0.15)' : active === tab.key ? AppColors.primary : AppColors.subtext}
            />
            {!tab.enabled && <Text style={styles.soonBadge}>Soon</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {(active === 'posts' || active === 'stories') && (
          <PostsGrid userId={userId} variant={active} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    position: 'relative',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: AppColors.primary,
  },
  soonBadge: {
    position: 'absolute',
    top: 4,
    right: '22%',
    fontSize: 7.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.2)',
    textTransform: 'uppercase',
  },
  content: { paddingTop: 2 },
});
