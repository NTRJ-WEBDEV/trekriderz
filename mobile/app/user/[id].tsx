import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import UserAvatar from '@/components/UserAvatar';

const GREEN = '#8CC63F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.07)';

export default function UserProfileScreen() {
  const { id: targetId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ trips: 0, followers: 0, following: 0 });
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (targetId) load(); }, [targetId]);

  const load = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const [profileRes, tripsRes, followersRes, followingRes, myFollowRes] = await Promise.all([
        supabase.from('users').select('id, full_name, avatar_url, bio, location, role, is_verified, created_at').eq('id', targetId).single(),
        supabase.from('trips').select('id', { count: 'exact', head: true }).eq('created_by', targetId),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetId).eq('status', 'accepted'),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetId).eq('status', 'accepted'),
        user?.id
          ? supabase.from('user_follows').select('status').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setProfile(profileRes.data);
      setStats({ trips: tripsRes.count ?? 0, followers: followersRes.count ?? 0, following: followingRes.count ?? 0 });
      const s = (myFollowRes as any)?.data?.status;
      setFollowStatus(s === 'accepted' ? 'accepted' : s === 'pending' ? 'pending' : 'none');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFollow = async () => {
    if (!user?.id || !targetId) return;
    setFollowing(true);
    try {
      if (followStatus !== 'none') {
        // Cancel a pending request, or unfollow if already accepted
        await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
        setFollowStatus('none');
        if (followStatus === 'accepted') {
          setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        }
      } else {
        const { error } = await supabase.from('user_follows').insert({
          follower_id: user.id,
          following_id: targetId,
          status: 'pending',
        });
        if (error) throw error;
        await supabase.from('notifications').insert({
          user_id: targetId,
          sender_id: user.id,
          type: 'follow',
          title: 'New Follow Request',
          message: 'wants to follow you',
          related_id: user.id,
        });
        setFollowStatus('pending');
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{profile.full_name || 'Traveler'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GREEN} />}
      >
        {/* Avatar + name */}
        <View style={styles.profileHeader}>
          <UserAvatar
            userId={profile.id}
            avatarUrl={profile.avatar_url}
            fullName={profile.full_name}
            size={88}
            style={styles.avatar}
          />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.full_name || 'Traveler'}</Text>
            {profile.is_verified && (
              <Ionicons name="checkmark-circle" size={19} color="#3897F0" style={styles.verifiedIcon} />
            )}
          </View>
          {profile.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={GREEN} />
              <Text style={styles.locationText}>{profile.location}</Text>
            </View>
          )}
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.trips}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Action buttons */}
        {!isSelf && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.followBtn,
                followStatus !== 'none' && styles.followBtnActive,
              ]}
              onPress={handleFollow}
              disabled={following}
            >
              {following ? (
                <ActivityIndicator size="small" color={followStatus !== 'none' ? '#FFF' : '#000'} />
              ) : (
                <>
                  <Ionicons
                    name={followStatus === 'accepted' ? 'checkmark' : followStatus === 'pending' ? 'time-outline' : 'person-add-outline'}
                    size={16}
                    color={followStatus !== 'none' ? '#FFF' : '#000'}
                  />
                  <Text style={[styles.followBtnText, followStatus !== 'none' && styles.followBtnTextActive]}>
                    {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.msgBtn} onPress={handleMessage}>
              <Ionicons name="chatbubble-outline" size={16} color="#FFF" />
              <Text style={styles.msgBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSelf && (
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/profile/edit')}>
            <Ionicons name="pencil-outline" size={15} color={GREEN} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        )}

        {/* Role badge */}
        {profile.role && profile.role !== 'user' && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {profile.role === 'guide' ? '🧭 Verified Guide'
                : profile.role === 'homestay_owner' ? '🏡 Homestay Owner'
                : profile.role === 'admin' ? '🛡️ TrekRiderz Team'
                : ''}
            </Text>
          </View>
        )}

        {/* Member since */}
        <Text style={styles.memberSince}>
          Member since {new Date(profile.created_at).getFullYear()}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  content: { paddingBottom: 60 },
  profileHeader: { alignItems: 'center', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 24 },
  avatar: { borderWidth: 3, borderColor: GREEN, marginBottom: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  name: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  verifiedIcon: { marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  bio: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 20,
    backgroundColor: CARD, borderRadius: 16, paddingVertical: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: BORDER },
  statValue: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  followBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 13,
  },
  followBtnActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: BORDER },
  followBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  followBtnTextActive: { color: '#FFF' },
  msgBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: BORDER,
  },
  msgBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 16,
    borderWidth: 1.5, borderColor: GREEN + '50',
    borderRadius: 12, paddingVertical: 12,
  },
  editBtnText: { color: GREEN, fontWeight: '700', fontSize: 14 },
  roleBadge: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  roleBadgeText: { color: GREEN, fontWeight: '700', fontSize: 13 },
  memberSince: { color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
