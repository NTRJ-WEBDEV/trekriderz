import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();

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
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon name="compass-outline" color={color} size={size} />
            ),
          }}
        />
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
              <TabBarIcon name="add-circle-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon name="notifications-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon name="person-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen name="chats" options={{ href: null }} />
        <Tabs.Screen name="feed" options={{ href: null }} />
      </Tabs>
    </>
  );
}

function TabBarIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return (
    <Ionicons name={name} size={size} color={color} />
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
});
