import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing, Radius } from '@/constants/theme';

type FollowState = 'none' | 'pending' | 'accepted';

interface Props {
  avatarUrl?: string;
  fullName: string;
  isVerified?: boolean;
  roleLabel?: string;
  bio?: string;
  location?: string;
  memberSinceYear?: number | null;
  coverImageUrl?: string; // future-ready — no column exists yet, falls back to a gradient
  mode: 'self' | 'other';
  onAvatarPress?: () => void;
  onEditProfile?: () => void;
  onSettings?: () => void;
  followState?: FollowState;
  followLoading?: boolean;
  onFollowPress?: () => void;
  onMessagePress?: () => void;
}

// Adventure Passport header — shared by both the own-profile screen and
// user/[id].tsx. `mode` swaps the action row (Edit Profile + Settings for
// self, Follow + Message for other users); everything else renders the
// same identity block either way.
export default function ProfileHeader({
  avatarUrl, fullName, isVerified, roleLabel, bio, location, memberSinceYear,
  coverImageUrl, mode, onAvatarPress, onEditProfile, onSettings,
  followState = 'none', followLoading, onFollowPress, onMessagePress,
}: Props) {
  return (
    <View>
      {/* Cover — future-ready; no cover_image column exists yet, so this is
          always the gradient fallback today. */}
      <View style={styles.coverWrap}>
        {coverImageUrl ? (
          <Image source={{ uri: coverImageUrl }} style={styles.coverImage} />
        ) : (
          <LinearGradient
            colors={['rgba(140,198,63,0.28)', 'rgba(8,12,20,0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coverImage}
          />
        )}
        {mode === 'self' && (
          <TouchableOpacity style={styles.settingsBtn} onPress={onSettings} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.identity}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={onAvatarPress}
          disabled={!onAvatarPress}
          activeOpacity={onAvatarPress ? 0.8 : 1}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{fullName.charAt(0).toUpperCase() || '?'}</Text>
            </View>
          )}
          {mode === 'self' && (
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={12} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.nameRow}>
          <Text style={styles.name}>{fullName}</Text>
          {isVerified && <Ionicons name="checkmark-circle" size={18} color="#3897F0" />}
        </View>

        {roleLabel && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
        )}

        {bio ? <Text style={styles.bio}>{bio}</Text> : null}

        <View style={styles.metaRow}>
          {location && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={13} color={AppColors.primary} />
              <Text style={styles.metaText}>{location}</Text>
            </View>
          )}
          {memberSinceYear && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={AppColors.subtext} />
              <Text style={styles.metaText}>Member since {memberSinceYear}</Text>
            </View>
          )}
        </View>

        {mode === 'self' ? (
          <TouchableOpacity style={styles.editProfileBtn} onPress={onEditProfile} activeOpacity={0.8}>
            <Ionicons name="pencil-outline" size={14} color={AppColors.primary} />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.followBtn, followState !== 'none' && styles.followBtnActive]}
              onPress={onFollowPress}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={followState !== 'none' ? '#FFF' : AppColors.background} />
              ) : (
                <>
                  <Ionicons
                    name={followState === 'accepted' ? 'checkmark' : followState === 'pending' ? 'time-outline' : 'person-add-outline'}
                    size={15}
                    color={followState !== 'none' ? '#FFF' : AppColors.background}
                  />
                  <Text style={[styles.followBtnText, followState !== 'none' && styles.followBtnTextActive]}>
                    {followState === 'accepted' ? 'Following' : followState === 'pending' ? 'Requested' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.msgBtn} onPress={onMessagePress} activeOpacity={0.8}>
              <Ionicons name="chatbubble-outline" size={15} color={AppColors.text} />
              <Text style={styles.msgBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coverWrap: { height: 120, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  settingsBtn: {
    position: 'absolute', top: Spacing.md, right: Spacing.lg,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  identity: { alignItems: 'center', paddingHorizontal: Spacing.xl, marginTop: -50 },
  avatarWrap: { position: 'relative', marginBottom: Spacing.md },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: AppColors.background,
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(140,198,63,0.25)',
    borderWidth: 3, borderColor: AppColors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: AppColors.primary, fontSize: 36, fontWeight: '800' },
  editBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: AppColors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: AppColors.background,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { color: AppColors.text, fontSize: 21, fontWeight: '800' },
  roleBadge: {
    backgroundColor: 'rgba(140,198,63,0.12)', borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)',
  },
  roleBadgeText: { color: AppColors.primary, fontSize: 11.5, fontWeight: '700' },
  bio: { color: AppColors.subtext, fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 10, paddingHorizontal: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: AppColors.subtext, fontSize: 12 },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.pill,
    borderWidth: 1.5, borderColor: 'rgba(140,198,63,0.5)', marginBottom: Spacing.lg,
  },
  editProfileText: { color: AppColors.primary, fontSize: 13.5, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, width: '100%', marginBottom: Spacing.lg },
  followBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: AppColors.primary, borderRadius: Radius.md, paddingVertical: 12,
  },
  followBtnActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: AppColors.border },
  followBtnText: { color: AppColors.background, fontWeight: '800', fontSize: 13.5 },
  followBtnTextActive: { color: '#FFF' },
  msgBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: AppColors.card, borderRadius: Radius.md, paddingVertical: 12,
    borderWidth: 1, borderColor: AppColors.border,
  },
  msgBtnText: { color: AppColors.text, fontWeight: '700', fontSize: 13.5 },
});
