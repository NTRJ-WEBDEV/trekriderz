import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// expo-notifications remote push is not available in Expo Go SDK 53+.
// Wrap handler setup in try-catch so the module still loads.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (_) {}

// Request permissions
export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Notification permissions not granted');
  }

  return finalStatus;
}

import { supabase } from './supabase';

// Get and register push token. Stays non-blocking for the caller (always
// resolves, never throws) — but each failure mode logs distinctly, since a
// single generic catch here previously made "permission denied," "no
// project ID," "token fetch failed" (the usual symptom of a missing/
// misconfigured FCM or APNs credential), and "DB save failed" all
// indistinguishable in logs.
export async function registerPushToken(userId: string) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Push token not registered: notification permission denied');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('Push token not registered: no EAS project ID found in app config');
      return null;
    }

    let token;
    try {
      token = await Notifications.getExpoPushTokenAsync({ projectId });
    } catch (tokenError) {
      console.error('Push token not registered: getExpoPushTokenAsync failed —', (tokenError as Error).message);
      return null;
    }

    if (token.data) {
      const { error } = await supabase
        .from('users')
        .update({ push_token: token.data })
        .eq('id', userId);

      if (error) console.error('Push token obtained but failed to save to DB:', error.message);
    }

    return token.data;
  } catch (error) {
    console.error('Unexpected error registering push token:', (error as Error).message);
    return null;
  }
}

// Schedule local notification
export async function scheduleNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput
) {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger,
    });
    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

// Send push notification (for testing)
export async function sendTestNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { test: true },
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
  }
}

// Cancel notification
export async function cancelNotification(identifier: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

// Cancel all notifications
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}

// Set up notification categories (for actions)
export function setupNotificationCategories() {
  if (Platform.OS === 'ios') {
    Notifications.setNotificationCategoryAsync('booking', [
      {
        identifier: 'view',
        buttonTitle: 'View Booking',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'cancel',
        buttonTitle: 'Cancel',
        options: { opensAppToForeground: true },
      },
    ]);
  }

  // Without this, Android falls back to a default channel with no custom
  // name/sound — notifications look like generic OS noise rather than
  // branded TrekRiderz alerts.
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'TrekRiderz',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8CC63F',
      sound: 'default',
    });
  }
}

// Listen for notification responses
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// Listen for received notifications (foreground)
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}
