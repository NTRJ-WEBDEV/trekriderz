import { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissions } from '../../hooks/usePermissions';

const CREATE_ACTIONS = [
  { label: 'Create Post', icon: 'image-outline' as const, route: '/post/create' },
  { label: 'Write Article', icon: 'book-outline' as const, route: '/stories/create' },
  { label: 'Plan a Trip', icon: 'map-outline' as const, route: '/(tabs)/create' },
  { label: 'Add Story (24hr)', icon: 'add-circle-outline' as const, route: '/story/create' },
];

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  // Reads the shared RBAC system (profiles.role_id via has_permission/
  // my_permissions) — the same source Web Admin reads, replacing the
  // earlier public.users.role='admin' check so both products gate on one
  // permission layer instead of two divergent ones.
  const { isStaff } = usePermissions();
  const isAdmin = isStaff;
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        initialRouteName="explore"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#8CC63F',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: {
            backgroundColor: 'rgba(8, 12, 20, 0.96)',
            borderTopColor: 'rgba(140, 198, 63, 0.18)',
            borderTopWidth: 1,
            height: 65 + bottom,
            paddingBottom: 10 + bottom,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        {/* Feed (Instagram-style posts + stories) — landing tab */}
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="newspaper-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Adventure (formerly Home) — trip/guide/homestay/rental discovery */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Adventure',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trail-sign-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Create — floating green button, opens an action sheet */}
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarButton: () => (
              <View style={styles.createButtonWrap}>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => setActionSheetVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={28} color="#080C14" />
                </TouchableOpacity>
              </View>
            ),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Discover — now embedded directly in Home; route stays reachable via deep link */}
        <Tabs.Screen name="discover" options={{ href: null }} />

        {/* Connect — trips, travel partners, rides, organizers, groups */}
        <Tabs.Screen
          name="community"
          options={{
            title: 'Connect',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Chat — direct messages */}
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Profile — reachable via the avatar in the Home header, not a bottom tab */}
        <Tabs.Screen name="profile" options={{ href: null }} />

        {/* Admin — visible only to admins. href: null removes its flex slot entirely
            for everyone else instead of just hiding its content (which was leaving an
            invisible gap in the tab bar and throwing off even spacing). Expo Router
            doesn't allow href and tabBarButton in the same options object, so the two
            cases are fully separate rather than spread together. */}
        <Tabs.Screen
          name="admin"
          options={
            isAdmin
              ? {
                  tabBarButton: () => (
                    <TouchableOpacity
                      onPress={() => router.push('/admin')}
                      style={styles.adminTabBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="settings-outline" size={22} color="#8CC63F" />
                      <Text style={styles.adminTabLabel}>Admin</Text>
                    </TouchableOpacity>
                  ),
                }
              : { href: null }
          }
        />

        {/* Hidden tabs — accessible via deep link / router.push only */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>

      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setActionSheetVisible(false)}
        >
          <View style={[styles.actionSheet, { paddingBottom: 16 + bottom }]}>
            {CREATE_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.route}
                style={styles.actionRow}
                onPress={() => {
                  setActionSheetVisible(false);
                  router.push(action.route as any);
                }}
              >
                <Ionicons name={action.icon} size={20} color="#8CC63F" />
                <Text style={styles.actionRowText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  createButtonWrap: {
    top: -18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8CC63F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#080C14',
    shadowColor: '#8CC63F',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  adminTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 10,
  },
  adminTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8CC63F',
    marginTop: 2,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#0F1420',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.15)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  actionRowText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
