import * as SQLite from 'expo-sqlite';

const DB_NAME = 'wandr_offline.db';

/**
 * Initialize the SQLite database with Trips and PendingTasks
 */
export async function initDatabase() {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // 1. Trips table (Cache for read)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        destination TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        itinerary TEXT,
        status TEXT,
        trip_type TEXT,
        group_size INTEGER,
        last_synced TEXT NOT NULL
      );
    `);

    // 2. Pending Tasks table (Queue for write)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
        table_name TEXT NOT NULL,
        payload TEXT NOT NULL,    -- JSON encoded object
        created_at TEXT NOT NULL
      );
    `);
    
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return null;
  }
}

/**
 * Queue a write operation for offline syncing
 */
export async function queueTask(operation: string, table_name: string, payload: any) {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.runAsync(
      'INSERT INTO pending_tasks (operation, table_name, payload, created_at) VALUES (?, ?, ?, ?)',
      [operation, table_name, JSON.stringify(payload), new Date().toISOString()]
    );
  } catch (error) {
    console.error('Error queuing task:', error);
  }
}

/**
 * Get all pending tasks
 */
export async function getPendingTasks(): Promise<any[]> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const tasks = await db.getAllAsync('SELECT * FROM pending_tasks ORDER BY created_at ASC');
    return tasks.map((t: any) => ({
      ...t,
      payload: JSON.parse(t.payload)
    }));
  } catch (error) {
    console.error('Error getting pending tasks:', error);
    return [];
  }
}

/**
 * Remove a completed task from the queue
 */
export async function removeTask(id: number) {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.runAsync('DELETE FROM pending_tasks WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error removing task:', error);
  }
}

/**
 * Save or update a trip in the local database (Cached for read)
 */
export async function cacheTrip(trip: any) {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const lastSynced = new Date().toISOString();
    
    const query = `
      INSERT OR REPLACE INTO trips (id, title, destination, start_date, end_date, itinerary, status, trip_type, group_size, last_synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    
    await db.runAsync(query, [
      trip.id,
      trip.title,
      trip.destination,
      trip.start_date,
      trip.end_date,
      JSON.stringify(trip.itinerary || {}),
      trip.status,
      trip.trip_type,
      trip.group_size || 0,
      lastSynced
    ]);
  } catch (error) {
    console.error('Error caching trip:', error);
  }
}

/**
 * Get all cached trips for offline viewing
 */
export async function getCachedTrips(): Promise<any[]> {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const trips = await db.getAllAsync('SELECT * FROM trips ORDER BY last_synced DESC');
    return trips.map((t: any) => ({
      ...t,
      itinerary: JSON.parse(t.itinerary || '{}')
    }));
  } catch (error) {
    console.error('Error getting cached trips:', error);
    return [];
  }
}
