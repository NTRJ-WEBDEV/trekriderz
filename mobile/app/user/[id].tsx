import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { AppColors } from '@/constants/theme';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileStatsRow from '@/components/profile/ProfileStatsRow';
import AdventureStatsGrid from '@/components/profile/AdventureStatsGrid';
import ProfileContentTabs from '@/components/profile/ProfileContentTabs';

const GREEN = AppColors.primary;
const BG = AppColors.background;
const CARD = AppColors.card;
const BORDER = AppColors.border;

const ROLE_LABELS: Record<string, string> = {
  guide: '🧭 Verified Guide',
  homestay_owner: '🏡 Homestay Owner',
  admin: '🛡️ TrekRiderz Team',
};

export default function UserProfileScreen() {
  const { id: targetId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    posts: 0, stories: 0, followers: 0, following: 0, tripsOrganized: 0, tripsJoined: 0,
  });
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const [
        profileRes, postsRes, storiesRes, followersRes, followingRes, organizedRes, joinedRes, myFollowRes,
      ] = await Promise.all([
        supabase.from('users').select('id, full_name, avatar_url, bio, location, role, is_verified, is_private, created_at').eq('id', targetId).single(),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', targetId).or('post_type.is.null,post_type.neq.trip_story'),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', targetId).eq('post_type', 'trip_story'),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetId).eq('status', 'accepted'),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetId).eq('status', 'accepted'),
        supabase.from('trip_members').select('id', { count: 'exact', head: true }).eq('user_id', targetId).eq('role', 'organizer'),
        supabase.from('trip_members').select('id', { count: 'exact', head: true }).eq('user_id', targetId).eq('role', 'member'),
        user?.id
          ? supabase.from('user_follows').select('status').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setProfile(profileRes.data);
      setStats({
        posts: postsRes.count ?? 0,
        stories: storiesRes.count ?? 0,
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
        tripsOrganized: organizedRes.count ?? 0,
        tripsJoined: joinedRes.count ?? 0,
      });
      const s = (myFollowRes as any)?.data?.status;
      setFollowStatus(s === 'accepted' ? 'accepted' : s === 'pending' ? 'pending' : 'none');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleFollow = async () => {
    if (!user?.id || !targetId) return;
    setFollowing(true);
    try {
      if (followStatus !== 'none') {
        await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
        setFollowStatus('none');
        if (followStatus === 'accepted') {
          setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        }
      } else {
        const isPrivate = !!profile?.is_private;
        const { error } = await supabase.from('user_follows').upsert({
          follower_id: user.id,
          following_id: targetId,
          status: isPrivate ? 'pending' : 'accepted',
        }, { onConflict: 'follower_id,following_id' });
        if (error) throw error;
        if (isPrivate) {
          setFollowStatus('pending');
        } else {
          setFollowStatus('accepted');
          setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update follow status');
    } finally {
      setFollowing(false);
    }
  };

  const handleMessage = () => {
    if (!targetId) return;
    router.push(`/dm/${targetId}` as any);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'rgba(255,255,255,0.4)' }}>User not found</Text>
      </View>
    );
  }

  const isSelf = user?.id === targetId;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{profile.full_name || 'Traveler'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GREEN} />}
      >
        <ProfileHeader
          mode="other"
          avatarUrl={profile.avatar_url}
          fullName={profile.full_name || 'Traveler'}
          isVerified={profile.is_verified}
          roleLabel={profile.role ? ROLE_LABELS[profile.role] : undefined}
          bio={profile.bio}
          location={profile.location}
          memberSinceYear={profile.created_at ? new Date(profile.created_at).getFullYear() : null}
          followState={isSelf ? undefined : followStatus}
          followLoading={following}
          onFollowPress={handleFollow}
          onMessagePress={handleMessage}
        />

        {isSelf && (
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/profile/edit')}>
            <Ionicons name="pencil-outline" size={15} color={GREEN} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <ProfileStatsRow
            stats={[
              { label: 'Posts', value: stats.posts },
              { label: 'Travel Stories', value: stats.stories },
              { label: 'Followers', value: stats.followers, onPress: () => router.push(`/followers/${targetId}?tab=followers` as any) },
              { label: 'Following', value: stats.following, onPress: () => router.push(`/followers/${targetId}?tab=following` as any) },
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
          <ProfileContentTabs userId={targetId!} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  navHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, justifyContent: 'center', alignItems: 'center',
  },
  navTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { paddingBottom: 60 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: -8, marginBottom: 8,
    borderWidth: 1.5, borderColor: GREEN + '50',
    borderRadius: 12, paddingVertical: 12,
  },
  editBtnText: { color: GREEN, fontWeight: '700', fontSize: 14 },
  section: { marginTop: 16 },
  tabsSection: { marginTop: 24 },
});
