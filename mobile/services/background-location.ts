import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { updateDatabaseLocation } from '../lib/location-service';

const LOCATION_TASK_NAME = 'background-location-task';

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
    }
  }
});
