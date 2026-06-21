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

// Get and register push token
export async function registerPushToken(userId: string) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    if (token.data) {
      const { error } = await supabase
        .from('users')
        .update({ push_token: token.data })
        .eq('id', userId);

      if (error) console.error('Error saving push token to DB:', error);
    }

    return token.data;
  } catch (error) {
    console.error('Error registering push token:', error);
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
