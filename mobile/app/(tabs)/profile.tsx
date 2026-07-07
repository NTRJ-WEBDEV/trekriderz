import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Image, ScrollView, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { authHelpers, supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#8CC63F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';

export default function ProfileScreen() {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [guideProfile, setGuideProfile] = useState<{ id: string; is_premium: boolean; status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ trips: 0, followers: 0 });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, tripsRes, followersRes, guideRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('trips').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
        supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id).eq('status', 'accepted'),
        supabase.from('guides').select('id, is_premium, status').eq('user_id', user.id).maybeSingle(),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (guideRes && guideRes.data) setGuideProfile(guideRes.data as any);
      setStats({ trips: tripsRes.count ?? 0, followers: followersRes.count ?? 0 });
    } catch (err) {
      // silently handle
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive', onPress: async () => {
          await authHelpers.signOut();
          setUser(null);
          router.replace('/login');
        }
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all trips, posts, and data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account', style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Are you absolutely sure? This is permanent and irreversible.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Permanently Delete', style: 'destructive',
                  onPress: async () => {
                    try {
                      await supabase.from('users').delete().eq('id', user!.id);
                      await authHelpers.signOut();
                      setUser(null);
                      router.replace('/login');
                    } catch (err) {
                      Alert.alert('Error', 'Could not delete account. Please contact support at support@trekriderz.app');
                    }
                  }
                },
              ]
            );
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchProfile(); }}
            tintColor={GREEN}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/profile/edit')}>
            <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.avatarWrapper} onPress={() => router.push('/profile/edit')}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.editIcon}>
              <Ionicons name="pencil" size={13} color="#FFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile?.full_name || 'Adventurer'}</Text>
            {profile?.is_verified && (
              <Ionicons name="checkmark-circle" size={19} color="#3897F0" style={styles.verifiedIcon} />
            )}
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/profile/edit')}>
              <Text style={styles.addBio}>+ Add a bio</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/profile/edit')}>
            <Ionicons name="pencil-outline" size={15} color={GREEN} style={{ marginRight: 6 }} />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Completeness */}
        <ProfileCompleteness profile={profile} stats={stats} onPress={() => router.push('/profile/edit')} />

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox
            label="Trips"
            value={String(stats.trips)}
            icon="airplane-outline"
            onPress={() => user && router.push(`/trips/${user.id}` as any)}
          />
          <View style={styles.statDivider} />
          <StatBox
            label="Followers"
            value={String(stats.followers)}
            icon="people-outline"
            onPress={() => user && router.push(`/followers/${user.id}` as any)}
          />
          <View style={styles.statDivider} />
          <StatBox
            label="Member Since"
            value={profile?.created_at ? new Date(profile.created_at).getFullYear().toString() : '—'}
            icon="calendar-outline"
          />
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          <Text style={styles.sectionLabel}>Account</Text>
          <MenuItem icon="person-outline" title="Edit Personal Details" onPress={() => router.push('/profile/edit')} />
          <MenuItem icon="notifications-outline" title="Push Notifications" onPress={() => router.push('/notification-preferences' as any)} />
          <MenuItem icon="cloud-offline-outline" title="Offline Cache Management" onPress={() => {}} />

          <Text style={styles.sectionLabel}>Content</Text>
          <MenuItem icon="images-outline" title="Manage Posts" subtitle="Edit or delete your feed posts" onPress={() => router.push('/profile/manage-posts' as any)} />
          <MenuItem icon="book-outline" title="Manage Travel Stories" subtitle="Edit or delete your travel stories" onPress={() => router.push('/profile/manage-stories' as any)} />

          <Text style={styles.sectionLabel}>Guide</Text>
          {!guideProfile ? (
            <MenuItem
              icon="ribbon-outline"
              title="Become a Certified Guide"
              subtitle="Apply to guide trekkers on TrekRiderz"
              onPress={() => router.push('/guide/register' as any)}
              accent
            />
          ) : guideProfile.status === 'pending' || guideProfile.status === 'under_review' || guideProfile.status === 'rejected' ? (
            <MenuItem
              icon="time-outline"
              title={guideProfile.status === 'rejected' ? 'Guide Application — Not Approved' : 'Guide Application Pending'}
              subtitle={guideProfile.status === 'rejected' ? 'Tap to view details and resubmit' : 'Our team is reviewing your application'}
              onPress={() => router.push('/guide/application-status' as any)}
            />
          ) : guideProfile.is_premium ? (
            <>
              <MenuItem icon="person-outline" title="My Guide Profile" subtitle="View how trekkers see you" onPress={() => router.push(`/guide/${guideProfile.id}` as any)} />
              <MenuItem icon="map-outline" title="My Expeditions" onPress={() => router.push('/expeditions/my-list' as any)} />
              <MenuItem icon="add-circle-outline" title="Create New Expedition" onPress={() => router.push('/expeditions/create' as any)} />
            </>
          ) : guideProfile.status === 'approved' ? (
            <>
              <MenuItem icon="person-outline" title="My Guide Profile" subtitle="View how trekkers see you" onPress={() => router.push(`/guide/${guideProfile.id}` as any)} />
              <MenuItem icon="ribbon-outline" title="Upgrade to Premium Guide" subtitle="Unlock expedition hosting" onPress={() => router.push('/expeditions/create' as any)} accent />
            </>
          ) : (
            <MenuItem icon="ribbon-outline" title="Upgrade to Premium Guide" subtitle="Unlock expedition hosting" onPress={() => router.push('/expeditions/create' as any)} accent />
          )}

          <Text style={styles.sectionLabel}>Host</Text>
          <MenuItem icon="business-outline" title="Manage My Properties" onPress={() => router.push('/host/my-properties' as any)} />
          <MenuItem
            icon="add-circle-outline"
            title="List a New Homestay"
            subtitle="Apply to host trekkers & travelers"
            onPress={() => router.push('/host/create' as any)}
          />

          <Text style={styles.sectionLabel}>Vehicles</Text>
          <MenuItem
            icon="car-outline"
            title="My Vehicle Listings"
            subtitle="Manage vehicles you've listed for rent"
            onPress={() => router.push('/rentals/my-vehicles' as any)}
          />
          <MenuItem
            icon="add-circle-outline"
            title="List a New Vehicle"
            subtitle="Rent out your bike, car or jeep"
            onPress={() => router.push('/rentals/register' as any)}
          />

          <Text style={styles.sectionLabel}>Legal</Text>
          <MenuItem icon="document-text-outline" title="Privacy Policy" onPress={() => router.push('/legal/privacy-policy' as any)} />
          <MenuItem icon="shield-checkmark-outline" title="Terms of Service" onPress={() => router.push('/legal/terms-of-service' as any)} />

          {profile?.role === 'admin' && (
            <>
              <Text style={styles.sectionLabel}>Administration</Text>
              <MenuItem
                icon="shield-checkmark-outline"
                title="Admin Dashboard"
                subtitle="Approve guides & homestays"
                onPress={() => router.push('/admin' as any)}
                accent
              />
            </>
          )}

          <Text style={styles.sectionLabel}>Support</Text>
          <MenuItem icon="help-circle-outline" title="Help & FAQ" onPress={() => {}} />
          <MenuItem icon="mail-outline" title="Contact Us" onPress={() => {}} />
        </View>

        {/* Log Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.75}>
          <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.25)" style={{ marginRight: 6 }} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={styles.version}>TrekRiderz v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileCompleteness({
  profile, stats, onPress,
}: { profile: any; stats: { trips: number; followers: number }; onPress: () => void }) {
  const steps = [
    { done: !!profile?.avatar_url, label: 'Profile photo' },
    { done: !!profile?.full_name, label: 'Full name' },
    { done: !!profile?.bio, label: 'Bio' },
    { done: stats.trips > 0, label: 'First trip' },
  ];
  const pct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  if (pct === 100) return null;
  const missing = steps.find((s) => !s.done);
  return (
    <TouchableOpacity style={styles.completenessCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.completenessHeader}>
        <Ionicons name="person-circle-outline" size={18} color={GREEN} />
        <Text style={styles.completenessTitle}>Complete your profile</Text>
        <Text style={styles.completenessPct}>{pct}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
      </View>
      {missing && (
        <Text style={styles.completenessTip}>Next: {missing.label} →</Text>
      )}
    </TouchableOpacity>
  );
}

function StatBox({
  label, value, icon, onPress,
}: { label: string; value: string; icon: string; onPress?: () => void }) {
  const content = (
    <>
      <Ionicons name={icon as any} size={18} color={GREEN} style={{ marginBottom: 4 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={styles.statBox} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.statBox}>{content}</View>;
}

function MenuItem({
  icon, title, subtitle, onPress, accent,
}: {
  icon: string; title: string; subtitle?: string; onPress: () => void; accent?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconWrap, accent && { backgroundColor: GREEN + '20' }]}>
        <Ionicons name={icon as any} size={18} color={accent ? GREEN : 'rgba(255,255,255,0.6)'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, accent && { color: GREEN }]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingBottom: 48,
  },

  // Header / Avatar
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    position: 'relative',
  },
  settingsBtn: {
    position: 'absolute',
    top: 12,
    right: 20,
    padding: 6,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2.5,
    borderColor: GREEN,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: GREEN + '30',
    borderWidth: 2.5,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: GREEN,
    fontSize: 34,
    fontWeight: '700',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  verifiedIcon: { marginTop: 1 },
  email: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginBottom: 8,
  },
  bio: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  addBio: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    marginBottom: 14,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: GREEN + '60',
    marginTop: 2,
  },
  editProfileText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '600',
  },

  // Completeness
  completenessCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: GREEN + '12',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: GREEN + '30',
  },
  completenessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  completenessTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  completenessPct: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '900',
  },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    backgroundColor: GREEN,
    borderRadius: 3,
  },
  completenessTip: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Menu
  menu: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 6,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  menuSubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },

  // Delete account
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
  },
  deleteText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
    fontWeight: '500',
  },

  // Version
  version: {
    color: 'rgba(255,255,255,0.12)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.5,
  },
});
