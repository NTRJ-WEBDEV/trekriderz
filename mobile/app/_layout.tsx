import { Stack, router, useRootNavigationState } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export {
  ErrorBoundary,
} from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { supabase } from '@/lib/supabase';
import { Alert, Linking } from 'react-native';
import { handleDeepLink } from '@/lib/deep-linking';
import {
  requestNotificationPermissions,
  registerPushToken,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  setupNotificationCategories,
} from '@/lib/notifications';
import { requestLocationPermissions, startLocationSharing } from '@/lib/location-service';
import '@/services/background-location';
import OfflineBanner from '@/components/OfflineBanner';
import { syncService } from '@/services/sync-service';
import { maybeRequestReview } from '@/lib/review-prompt';
import { cleanupExpiredOfflineCaches } from '@/lib/offline-safety';

const queryClient = new QueryClient();

export default function RootLayout() {
  const init = useAuthStore((state) => state.init);
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const notificationCleanup = useRef<(() => void) | null>(null);
  const navState = useRootNavigationState();

  useEffect(() => {
    init();
    setupNotificationCategories();
    // Purely local (AsyncStorage only) — runs unconditionally, before auth or
    // any network resolves, so expired offline-safety caches get pruned even
    // on a fully offline cold start.
    cleanupExpiredOfflineCaches().catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handleDeepLink(e.url));
    Linking.getInitialURL().then((u) => { if (u) handleDeepLink(u); });
    return () => {
      sub.remove();
      notificationCleanup.current?.();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const setupServices = async () => {
      // Each piece below runs in its own try/catch — previously all of this
      // sat in one try/catch, so a notification-permission denial (which
      // requestNotificationPermissions() throws on) silently skipped the
      // push token, the unread badge, the location-consent check, and the
      // notification listeners too, with one generic "Root setup err" log
      // that gave no way to tell which piece actually failed.
      try {
        maybeRequestReview();
      } catch (err) {
        console.error('Review prompt setup failed:', err);
      }

      try {
        await requestNotificationPermissions();
        await registerPushToken(user.id);
      } catch (err) {
        console.error('Push notification setup failed:', err);
      }

      try {
        useNotificationStore.getState().init(user.id);
      } catch (err) {
        console.error('Notification badge init failed:', err);
      }

      // Permission is still requested up front (offline trail recording
      // needs it too), but the background task only auto-starts if the
      // user already consented to member-location-sharing on a previous
      // visit to the Safety screen — it's no longer unconditional.
      requestLocationPermissions()
        .then(async () => {
          const { data } = await supabase
            .from('users')
            .select('location_sharing_enabled')
            .eq('id', user.id)
            .single();
          if (data?.location_sharing_enabled) await startLocationSharing();
        })
        .catch((err) => console.error('Location consent check failed:', err));
      // Sync service initialized via background location

      try {
        const recListener = addNotificationReceivedListener((notif) => {
          if (__DEV__) console.log('Foreground Notif:', notif);
        });

        const resListener = addNotificationResponseListener((res) => {
          const { data } = res.notification.request.content as { data?: any };
          if (data?.type === 'trip_invite') {
            router.push('/notifications' as any);
          } else if (data?.type === 'booking') {
            router.push('/bookings' as any);
          } else if (data?.type === 'chat' && data.trip_id) {
            router.push(`/chat/${data.trip_id}` as any);
          } else if (data?.type === 'sos_alert' && data.trip_id) {
            // Map screen shows live member pins — the most actionable place
            // to land someone who just got paged about an emergency.
            router.push(`/map/${data.trip_id}` as any);
          } else if (data?.type === 'follow') {
            // sender_id is the follower — forwarded by send-notification
            // from the notification row itself, not metadata (follow never
            // sets metadata).
            if (data.sender_id) router.push(`/user/${data.sender_id}` as any);
            else router.push('/notifications' as any);
          } else {
            // like/comment (no post-detail screen exists yet to deep-link
            // to) or any other/future type — land on the list rather than
            // doing nothing.
            router.push('/notifications' as any);
          }
        });

        const channel = supabase
          .channel(`notifications:${user.id}`)
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`
          }, (p) => {
            Alert.alert(p.new.title, p.new.message, [
              { text: 'View', onPress: () => {
                if (p.new.type === 'trip_invite') router.push('/notifications' as any);
                else if (p.new.type === 'booking') router.push('/bookings' as any);
                else if (p.new.type === 'sos_alert' && p.new.related_id) router.push(`/map/${p.new.related_id}` as any);
              }},
              { text: 'Later' }
            ]);
          })
          .subscribe();

        notificationCleanup.current = () => {
          resListener.remove();
          recListener.remove();
          supabase.removeChannel(channel);
          useNotificationStore.getState().cleanup();
        };
      } catch (err) {
        console.error('Notification listeners setup failed:', err);
      }
    };

    setupServices();
    return () => notificationCleanup.current?.();
    // Depend on the id, not the `user` object reference — auth init sets a
    // fresh object 2-3x in a row during cold start (cached user, resolved
    // session, onAuthStateChange's immediate fire) for the same underlying
    // user, and keying off `[user]` re-ran this effect for each one,
    // racing multiple concurrent realtime .channel(sameName).subscribe()
    // calls into the "cannot add postgres_changes callbacks after
    // subscribe()" error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Wait for navigator to mount before redirecting
  useEffect(() => {
    if (!navState?.key || authLoading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [navState?.key, user, authLoading]);

  // Show splash while session is being restored from storage
  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#8CC63F" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="auth/confirm" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="trip/[id]" />
        <Stack.Screen name="trip/edit/[id]" />
        <Stack.Screen name="chat/[tripId]" />
        <Stack.Screen name="trip-members/[tripId]" />
        <Stack.Screen name="invite/[tripId]" />
        <Stack.Screen name="itinerary/[tripId]" />
        <Stack.Screen name="packing/[tripId]" />
        <Stack.Screen name="budget/[tripId]" />
        <Stack.Screen name="safety/[tripId]" />
        <Stack.Screen name="map/[tripId]" />
        <Stack.Screen name="trail-view/index" />
        <Stack.Screen name="poi/submit" />
        <Stack.Screen name="homestay/[id]" />
        <Stack.Screen name="guide/[id]" />
        <Stack.Screen name="hire/[id]" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="booking-details/[id]" />
        <Stack.Screen name="bookings/index" />
        <Stack.Screen name="host/index" />
        <Stack.Screen name="host/create" />
        <Stack.Screen name="host/status" />
        <Stack.Screen name="host/manage" />
        <Stack.Screen name="host/my-properties" />
        <Stack.Screen name="guide/register" />
        <Stack.Screen name="guide/application-status" />
        <Stack.Screen name="partner/review" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="post/create" />
        <Stack.Screen name="create-post" />
        <Stack.Screen name="watch-video" />
        <Stack.Screen name="discover" />
        <Stack.Screen name="community/index" />
        <Stack.Screen name="community/[id]" />
        <Stack.Screen name="community/create" />
        <Stack.Screen name="community/manage/[id]" />
        <Stack.Screen name="dm/[userId]" />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="admin/add-guide" />
        <Stack.Screen name="admin/add-homestay" />
        <Stack.Screen name="expeditions/index" />
        <Stack.Screen name="expeditions/[id]" />
        <Stack.Screen name="expeditions/create" />
        <Stack.Screen name="expeditions/manage/[id]" />
        <Stack.Screen name="expeditions/my-list" />
        <Stack.Screen name="legal/privacy-policy" />
        <Stack.Screen name="legal/terms-of-service" />
        <Stack.Screen name="notification-preferences" />
        <Stack.Screen name="ai-planner" />
        <Stack.Screen name="rentals/index" />
        <Stack.Screen name="rentals/[id]" />
        <Stack.Screen name="rentals/register" />
        <Stack.Screen name="rentals/my-vehicles" />
        <Stack.Screen name="rentals/edit" />
        <Stack.Screen name="stories/index" />
        <Stack.Screen name="stories/[id]" />
        <Stack.Screen name="stories/create" />
        <Stack.Screen name="story/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="story/view" options={{ presentation: 'modal', animation: 'fade' }} />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="followers/[id]" />
        <Stack.Screen name="post/likes/[id]" />
      </Stack>
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}
