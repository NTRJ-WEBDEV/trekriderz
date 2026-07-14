import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────

export interface TrailPoint {
  lat: number;
  lng: number;
  t: number; // client timestamp, ms epoch
}

export interface CachedPoi {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

export interface CachedTrail {
  tripId: string;
  tripTitle: string;
  tripEndDate: string; // ISO date — stored locally so cleanup never needs network
  destinationLat?: number;
  destinationLng?: number;
  coordinates: TrailPoint[];
  pois: CachedPoi[];
  cachedAt: number;
}

export interface CachedHomestayRoute {
  homestayId: string;
  homestayName: string;
  homestayLat: number;
  homestayLng: number;
  fromLat: number;
  fromLng: number;
  cachedAt: number;
}

// ── Key naming ───────────────────────────────────────────────────────────

const TRAIL_PREFIX = 'offline_trail_';
const PENDING_PREFIX = 'offline_trail_pending_';
const ACTIVE_TRIP_KEY = 'offline_active_trip_id';
const HOMESTAY_ROUTE_KEY = 'offline_homestay_route';
const HOMESTAY_ROUTE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days — not trip-bound, so its own simple TTL

const trailKey = (tripId: string) => `${TRAIL_PREFIX}${tripId}`;
const pendingKey = (tripId: string) => `${PENDING_PREFIX}${tripId}`;

// ── Geo helpers (no PostGIS, no library — plain haversine/bearing) ─────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// ── Active-trip flag (read by the background location task) ───────────────

export async function setActiveTrailTripId(tripId: string | null): Promise<void> {
  try {
    if (tripId) await AsyncStorage.setItem(ACTIVE_TRIP_KEY, tripId);
    else await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  } catch (error) {
    console.error('setActiveTrailTripId error:', error);
  }
}

export async function getActiveTrailTripId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  } catch {
    return null;
  }
}

// ── Trail cache: read/write ─────────────────────────────────────────────

export async function getCachedTrail(tripId: string): Promise<CachedTrail | null> {
  try {
    const raw = await AsyncStorage.getItem(trailKey(tripId));
    return raw ? (JSON.parse(raw) as CachedTrail) : null;
  } catch (error) {
    console.error('getCachedTrail error:', error);
    return null;
  }
}

/**
 * Called while online, from the trip map screen, to (re)seed the local trail
 * cache: pulls any points already recorded server-side (e.g. from a prior
 * session/device) and refreshes the nearby-POI list. Coordinates already
 * buffered locally are preserved, not overwritten.
 */
export async function primeTrailCache(params: {
  tripId: string;
  tripTitle: string;
  tripEndDate: string;
  destinationLat?: number;
  destinationLng?: number;
  radiusKm?: number;
}): Promise<void> {
  const { tripId, tripTitle, tripEndDate, destinationLat, destinationLng, radiusKm = 15 } = params;
  const existing = await getCachedTrail(tripId);

  let coordinates = existing?.coordinates ?? [];
  try {
    const { data: remote } = await supabase
      .from('trail_routes')
      .select('coordinates')
      .eq('trip_id', tripId)
      .maybeSingle();
    const remoteCoords = (remote?.coordinates as TrailPoint[] | undefined) ?? [];
    if (remoteCoords.length > coordinates.length) coordinates = remoteCoords;
  } catch (error) {
    console.error('primeTrailCache: could not fetch remote trail (offline?):', error);
  }

  let pois: CachedPoi[] = existing?.pois ?? [];
  if (destinationLat != null && destinationLng != null) {
    try {
      const { data: allPois } = await supabase
        .from('pois')
        .select('id, name, category, lat, lng')
        .eq('status', 'approved');
      pois = (allPois || [])
        .filter((p: any) => haversineKm(destinationLat, destinationLng, p.lat, p.lng) <= radiusKm)
        .map((p: any) => ({ id: p.id, name: p.name, category: p.category, lat: p.lat, lng: p.lng }));
    } catch (error) {
      console.error('primeTrailCache: could not fetch nearby POIs (offline?):', error);
    }
  }

  const cached: CachedTrail = {
    tripId,
    tripTitle,
    tripEndDate,
    destinationLat,
    destinationLng,
    coordinates,
    pois,
    cachedAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(trailKey(tripId), JSON.stringify(cached));
  } catch (error) {
    console.error('primeTrailCache: write error:', error);
  }
}

/** Appends one GPS point to the local trail cache — this is what the offline view reads. */
export async function appendCachedTrailPoint(tripId: string, point: TrailPoint): Promise<void> {
  try {
    const existing = await getCachedTrail(tripId);
    if (!existing) return; // no cache primed for this trip yet — nothing to append to
    existing.coordinates.push(point);
    await AsyncStorage.setItem(trailKey(tripId), JSON.stringify(existing));
  } catch (error) {
    console.error('appendCachedTrailPoint error:', error);
  }
}

// ── Pending-sync buffer: points not yet flushed to trail_routes ────────────

export async function appendPendingPoint(tripId: string, point: TrailPoint): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(tripId));
    const pending: TrailPoint[] = raw ? JSON.parse(raw) : [];
    pending.push(point);
    await AsyncStorage.setItem(pendingKey(tripId), JSON.stringify(pending));
  } catch (error) {
    console.error('appendPendingPoint error:', error);
  }
}

export async function getPendingPoints(tripId: string): Promise<TrailPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(tripId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearPendingPoints(tripId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(pendingKey(tripId));
  } catch (error) {
    console.error('clearPendingPoints error:', error);
  }
}

/** Flushes buffered points to trail_routes via the atomic append RPC. No-op (and leaves the buffer intact) if offline or the call fails. */
export async function flushPendingPoints(tripId: string): Promise<boolean> {
  const pending = await getPendingPoints(tripId);
  if (pending.length === 0) return true;
  try {
    const { error } = await supabase.rpc('append_trail_points', { p_trip_id: tripId, p_points: pending });
    if (error) throw error;
    await clearPendingPoints(tripId);
    return true;
  } catch (error) {
    console.error('flushPendingPoints: failed (likely offline), will retry later:', error);
    return false;
  }
}

// ── Homestay "route to shelter" cache — single slot, own TTL ───────────────

export async function cacheHomestayRoute(route: Omit<CachedHomestayRoute, 'cachedAt'>): Promise<void> {
  try {
    const entry: CachedHomestayRoute = { ...route, cachedAt: Date.now() };
    await AsyncStorage.setItem(HOMESTAY_ROUTE_KEY, JSON.stringify(entry));
  } catch (error) {
    console.error('cacheHomestayRoute error:', error);
  }
}

export async function getCachedHomestayRoute(): Promise<CachedHomestayRoute | null> {
  try {
    const raw = await AsyncStorage.getItem(HOMESTAY_ROUTE_KEY);
    return raw ? (JSON.parse(raw) as CachedHomestayRoute) : null;
  } catch {
    return null;
  }
}

// ── Enumerate all cached trails (for the trail-view screen to auto-pick one) ─

export async function getAllCachedTrails(): Promise<CachedTrail[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const trailKeys = keys.filter((k) => k.startsWith(TRAIL_PREFIX));
    if (trailKeys.length === 0) return [];
    const pairs = await AsyncStorage.multiGet(trailKeys);
    return pairs
      .map(([, v]) => (v ? (JSON.parse(v) as CachedTrail) : null))
      .filter((t): t is CachedTrail => t !== null);
  } catch (error) {
    console.error('getAllCachedTrails error:', error);
    return [];
  }
}

// ── Cleanup: delete cached data for trips that have already ended ──────────

/**
 * Runs on app launch. Purely local — compares each cached trail's own stored
 * tripEndDate against today, no network call needed. Also prunes the
 * homestay route cache once it's older than its own TTL, since it isn't
 * trip-scoped.
 */
export async function cleanupExpiredOfflineCaches(): Promise<{ trailsRemoved: number; homestayRouteRemoved: boolean }> {
  let trailsRemoved = 0;
  let homestayRouteRemoved = false;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const trails = await getAllCachedTrails();
    for (const trail of trails) {
      if (trail.tripEndDate && trail.tripEndDate < todayStr) {
        await AsyncStorage.removeItem(trailKey(trail.tripId));
        await AsyncStorage.removeItem(pendingKey(trail.tripId));
        trailsRemoved++;
      }
    }

    const activeTripId = await getActiveTrailTripId();
    if (activeTripId) {
      const stillCached = await getCachedTrail(activeTripId);
      if (!stillCached) await setActiveTrailTripId(null); // its trail just got cleaned up — stop attributing new points to it
    }

    const homestayRoute = await getCachedHomestayRoute();
    if (homestayRoute && Date.now() - homestayRoute.cachedAt > HOMESTAY_ROUTE_MAX_AGE) {
      await AsyncStorage.removeItem(HOMESTAY_ROUTE_KEY);
      homestayRouteRemoved = true;
    }
  } catch (error) {
    console.error('cleanupExpiredOfflineCaches error:', error);
  }

  return { trailsRemoved, homestayRouteRemoved };
}
