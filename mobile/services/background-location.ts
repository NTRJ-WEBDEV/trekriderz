import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { updateDatabaseLocation } from '../lib/location-service';
import {
  getActiveTrailTripId,
  appendCachedTrailPoint,
  appendPendingPoint,
  getPendingPoints,
  flushPendingPoints,
} from '../lib/offline-safety';

const LOCATION_TASK_NAME = 'background-location-task';

// Flush to trail_routes once this many points have buffered locally — a
// simple threshold, not a timer, so it self-adjusts to however often
// location updates actually arrive (every 5min / 100m per the existing
// startLocationSharing config).
const TRAIL_FLUSH_THRESHOLD = 5;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude } = location.coords;

      console.log('Background location update:', latitude, longitude);

      // Update database
      await updateDatabaseLocation({ latitude, longitude });

      // Trail recording — only while a trip's map screen has marked itself
      // active (see setActiveTrailTripId in map/[tripId].tsx). Buffering and
      // flushing are independent: the local trail cache (what the offline
      // view reads) grows immediately and unconditionally; the sync flush is
      // opportunistic and just leaves its buffer alone on failure/offline.
      const activeTripId = await getActiveTrailTripId();
      if (activeTripId) {
        const point = { lat: latitude, lng: longitude, t: Date.now() };
        await appendCachedTrailPoint(activeTripId, point);
        await appendPendingPoint(activeTripId, point);

        const pending = await getPendingPoints(activeTripId);
        if (pending.length >= TRAIL_FLUSH_THRESHOLD) {
          await flushPendingPoints(activeTripId);
        }
      }
    }
  }
});
