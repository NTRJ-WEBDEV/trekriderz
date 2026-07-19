import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { AppColors } from '@/constants/theme';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileStatsRow from '@/components/profile/ProfileStatsRow';
import AdventureStatsGrid from '@/components/profile/AdventureStatsGrid';
import ProfileContentTabs from '@/components/profile/ProfileContentTabs';

const BG = AppColors.background;

const ROLE_LABELS: Record<string, string> = {
  guide: '🧭 Verified Guide',
  homestay_owner: '🏡 Homestay Owner',
  admin: '🛡️ TrekRiderz Team',
};

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    posts: 0, stories: 0, followers: 0, following: 0, tripsOrganized: 0, tripsJoined: 0,
  });

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const [
        profileRes, postsRes, storiesRes, followersRes, followingRes, organizedRes, joinedRes,
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).or('post_type.is.null,post_type.neq.trip_story'),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('post_type', 'trip_story'),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id).eq('status', 'accepted'),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id).eq('status', 'accepted'),
        supabase.from('trip_members').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('role', 'organizer'),
        supabase.from('trip_members').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('role', 'member'),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      setStats({
        posts: postsRes.count ?? 0,
        stories: storiesRes.count ?? 0,
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
        tripsOrganized: organizedRes.count ?? 0,
        tripsJoined: joinedRes.count ?? 0,
      });
    } catch (err) {
      // silently handle
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  if (!user) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor={AppColors.primary} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <ProfileHeader
          mode="self"
          avatarUrl={profile?.avatar_url}
          fullName={profile?.full_name || 'Adventurer'}
          isVerified={profile?.is_verified}
          roleLabel={profile?.role ? ROLE_LABELS[profile.role] : undefined}
          bio={profile?.bio}
          location={profile?.location}
          memberSinceYear={profile?.created_at ? new Date(profile.created_at).getFullYear() : null}
          onAvatarPress={() => router.push('/profile/edit')}
          onEditProfile={() => router.push('/profile/edit')}
          onSettings={() => router.push('/profile/settings' as any)}
        />

        <View style={styles.section}>
          <ProfileStatsRow
            stats={[
              { label: 'Posts', value: stats.posts },
              { label: 'Travel Stories', value: stats.stories },
              { label: 'Followers', value: stats.followers, onPress: () => router.push(`/followers/${user.id}?tab=followers` as any) },
              { label: 'Following', value: stats.following, onPress: () => router.push(`/followers/${user.id}?tab=following` as any) },
              { label: 'Trips Joined', value: stats.tripsJoined },
              { label: 'Trips Organized', value: stats.tripsOrganized },
            ]}
          />
        </View>

        <View style={styles.section}>
          <AdventureStatsGrid
            stats={[
              { icon: 'trail-sign-outline', label: 'Treks Completed' },
              { icon: 'speedometer-outline', label: 'Ride Distance', unit: 'km' },
              { icon: 'compass-outline', label: 'Places Explored' },
              { icon: 'flame-outline', label: 'Nights Camped' },
              { icon: 'map-outline', label: 'States Visited' },
            ]}
          />
        </View>

        <View style={styles.tabsSection}>
          <ProfileContentTabs userId={user.id} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: 48 },
  section: { marginTop: 16 },
  tabsSection: { marginTop: 24 },
});
