import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const { user, loading } = useAuthStore();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user has seen onboarding
    AsyncStorage.getItem('hasSeenOnboarding').then((value) => {
      setHasSeenOnboarding(value === 'true');
    });
  }, []);

  if (loading || hasSeenOnboarding === null) {
    return null; // Show splash screen while loading
  }

  // First time user - show onboarding
  if (!hasSeenOnboarding && !user) {
    return <Redirect href="/onboarding" />;
  }

  // Returning user without auth - show login
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Authenticated user - show main app
  return <Redirect href="/(tabs)" />;
}
