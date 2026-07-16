import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

const LOCATION_TASK_NAME = 'background-location-task';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  timestamp: number;
}

// 1. Request Permissions
export async function requestLocationPermissions() {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    throw new Error('Foreground location permission not granted');
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    console.warn('Background location permission not granted');
    // We can still share when the app is open
  }

  return { foregroundStatus, backgroundStatus };
}

// 2. Start Sharing
export async function startLocationSharing() {
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isStarted) {
      console.log('Location updates already started');
      return;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5 * 60 * 1000, // Every 5 minutes
      distanceInterval: 100, // Or every 100 meters
      foregroundService: {
        notificationTitle: 'Sharing Location',
        notificationBody: 'Your location is being shared with your trip members',
        notificationColor: '#8CC63F',
      },
    });

    console.log('Started background location updates');
  } catch (error) {
    console.error('Error starting location sharing:', error);
  }
}

// 3. Stop Sharing
export async function stopLocationSharing() {
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('Stopped background location updates');
    }
  } catch (error) {
    console.error('Error stopping location sharing:', error);
  }
}

// 4. Update Database
export async function updateDatabaseLocation(coords: { latitude: number; longitude: number }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Gate at the write, not at whether the background task runs — the task
    // also drives offline trail recording, which must keep working
    // regardless of member-sharing consent. This is the real privacy
    // boundary: it silently matches zero rows when the user hasn't
    // consented, instead of ever writing a position trip members can see.
    const { error } = await supabase
      .from('users')
      .update({
        last_latitude: coords.latitude,
        last_longitude: coords.longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', user.id)
      .eq('location_sharing_enabled', true);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating location in database:', error);
  }
}
