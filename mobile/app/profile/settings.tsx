import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { authHelpers, supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';
import ScreenHeader from '@/components/ui/ScreenHeader';

const GREEN = AppColors.primary;
const BG = AppColors.background;
const CARD = AppColors.card;

// All account-management items moved out of the profile screen (identity +
// content now, not settings) — same MenuItem entries, same handlers, just
// relocated behind the profile header's settings icon instead of being
// the profile screen itself.
export default function SettingsScreen() {
  const { user, setUser } = useAuthStore();
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [guideProfile, setGuideProfile] = useState<{ id: string; is_premium: boolean; status: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profileRes, guideRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', user.id).single(),
        supabase.from('guides').select('id, is_premium, status').eq('user_id', user.id).maybeSingle(),
      ]);
      if (profileRes.data) setProfileRole(profileRes.data.role);
      if (guideRes.data) setGuideProfile(guideRes.data as any);
    })();
  }, [user]);

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
      <ScreenHeader title="Settings" fallbackRoute="/(tabs)/profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.menu}>
          <Text style={styles.sectionLabel}>Account</Text>
          <MenuItem icon="person-outline" title="Edit Personal Details" onPress={() => router.push('/profile/edit')} />
          <MenuItem icon="notifications-outline" title="Push Notifications" onPress={() => router.push('/notification-preferences' as any)} />
          <MenuItem icon="cloud-offline-outline" title="Offline Cache Management" onPress={() => {}} />

          <Text style={styles.sectionLabel}>Content</Text>
          <MenuItem icon="images-outline" title="Manage Posts" subtitle="Edit or delete your feed posts" onPress={() => router.push('/profile/manage-posts' as any)} />
          <MenuItem icon="book-outline" title="Manage Articles" subtitle="Edit or delete your articles" onPress={() => router.push('/profile/manage-stories' as any)} />

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

          {profileRole === 'admin' && (
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

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.75}>
          <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.25)" style={{ marginRight: 6 }} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={styles.version}>TrekRiderz v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
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
  container: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: 48 },
  menu: { marginTop: 8, marginHorizontal: 16 },
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
  menuTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  menuSubtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
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
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
  },
  deleteText: { color: 'rgba(255,255,255,0.2)', fontSize: 12, fontWeight: '500' },
  version: {
    color: 'rgba(255,255,255,0.12)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.5,
  },
});
