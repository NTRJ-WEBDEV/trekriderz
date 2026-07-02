import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  const { user } = useAuthStore();
  const router = useRouter();
  const isAdmin = (user as any)?.role === 'admin';

  return (
    <>
      <StatusBar style="light" />
      <Tabs
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
        {/* Home */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Feed (Instagram-style posts + stories) */}
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="newspaper-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Create — floating green button */}
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarButton: (props) => (
              <View style={styles.createButtonWrap}>
                <TouchableOpacity {...(props as any)} style={styles.createButton}>
                  <Ionicons name="add" size={28} color="#080C14" />
                </TouchableOpacity>
              </View>
            ),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Discover — browse guides, homestays, trips, vehicles */}
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass-outline" size={size} color={color} />
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

        {/* Profile */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Admin — visible only to admins */}
        <Tabs.Screen
          name="admin"
          options={{
            tabBarButton: isAdmin ? () => (
              <TouchableOpacity
                onPress={() => router.push('/admin')}
                style={styles.adminTabBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={22} color="#8CC63F" />
                <Text style={styles.adminTabLabel}>Admin</Text>
              </TouchableOpacity>
            ) : () => null,
          }}
        />

        {/* Hidden tabs — accessible via deep link / router.push only */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="feed" options={{ href: null }} />
      </Tabs>
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
});
