import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  getCachedTrail,
  getAllCachedTrails,
  getCachedHomestayRoute,
  getActiveTrailTripId,
  haversineKm,
  bearingDeg,
  compassLabel,
  CachedTrail,
  CachedHomestayRoute,
} from '@/lib/offline-safety';
import { AppColors } from '@/constants/theme';

const BG = AppColors.background;
const AMBER = '#F59E0B';
const GREEN = AppColors.primary;

const { width: SCREEN_W } = Dimensions.get('window');
const CANVAS_H = 420;
const PADDING = 28;

const POI_EMOJI: Record<string, string> = {
  waterfall: '💧', viewpoint: '🌄', peak: '⛰️', campsite: '⛺', temple: '🛕', other: '📍',
};

interface ScreenPoint { x: number; y: number; }
interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number; }

function makeBounds(points: { lat: number; lng: number }[]): Bounds {
  if (points.length === 0) {
    return { minLat: -0.01, maxLat: 0.01, minLng: -0.01, maxLng: 0.01 };
  }
  let minLat = points[0].lat, maxLat = points[0].lat, minLng = points[0].lng, maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  // Pad the bounds outward a bit so points aren't flush against the edges.
  const latPad = Math.max((maxLat - minLat) * 0.15, 0.003);
  const lngPad = Math.max((maxLng - minLng) * 0.15, 0.003);
  return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLng: minLng - lngPad, maxLng: maxLng + lngPad };
}

function project(lat: number, lng: number, bounds: Bounds, width: number, height: number): ScreenPoint {
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const cosLat = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.1);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.002);
  const lngSpanCorrected = Math.max((bounds.maxLng - bounds.minLng) * cosLat, 0.002);
  const usableW = width - PADDING * 2;
  const usableH = height - PADDING * 2;
  const scale = Math.min(usableW / lngSpanCorrected, usableH / latSpan);
  const drawnW = lngSpanCorrected * scale;
  const drawnH = latSpan * scale;
  const offsetX = PADDING + (usableW - drawnW) / 2;
  const offsetY = PADDING + (usableH - drawnH) / 2;
  return {
    x: offsetX + (lng - bounds.minLng) * cosLat * scale,
    y: offsetY + (bounds.maxLat - lat) * scale,
  };
}

function LineSegment({ from, to, color, thickness = 3, dashed = false }: {
  from: ScreenPoint; to: ScreenPoint; color: string; thickness?: number; dashed?: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return null;
  const angleRad = Math.atan2(dy, dx);
  return (
    <View
      style={{
        position: 'absolute',
        left: from.x,
        top: from.y - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: color,
        opacity: dashed ? 0.6 : 1,
        borderRadius: thickness / 2,
        transform: [
          { translateX: length / 2 },
          { rotate: `${angleRad}rad` },
          { translateX: -length / 2 },
        ],
      }}
    />
  );
}

function Pin({ point, emoji, color, size = 26, label }: { point: ScreenPoint; emoji: string; color: string; size?: number; label?: string }) {
  return (
    <View style={{ position: 'absolute', left: point.x - size / 2, top: point.y - size / 2, alignItems: 'center' }}>
      <View style={[styles.pin, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
      </View>
      {label && <Text style={styles.pinLabel} numberOfLines={1}>{label}</Text>}
    </View>
  );
}

export default function TrailViewScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string }>();
  const [trail, setTrail] = useState<CachedTrail | null>(null);
  const [homestayRoute, setHomestayRoute] = useState<CachedHomestayRoute | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const watchSub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      let resolvedTrail: CachedTrail | null = null;
      if (tripIdParam) {
        resolvedTrail = await getCachedTrail(tripIdParam);
      } else {
        const activeId = await getActiveTrailTripId();
        const all = await getAllCachedTrails();
        resolvedTrail = (activeId && all.find((t) => t.tripId === activeId))
          || all.sort((a, b) => b.cachedAt - a.cachedAt)[0]
          || null;
      }
      const route = await getCachedHomestayRoute();
      if (!active) return;
      setTrail(resolvedTrail);
      setHomestayRoute(route);
      setLoaded(true);
    }
    load();

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync();
        if (last && active) setUserPos({ lat: last.coords.latitude, lng: last.coords.longitude });
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (active) setUserPos({ lat: current.coords.latitude, lng: current.coords.longitude });

        watchSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 15 },
          (loc) => { if (active) setUserPos({ lat: loc.coords.latitude, lng: loc.coords.longitude }); }
        );
      } catch (_) {
        // No GPS fix available (rare, e.g. deep indoors) — the view still
        // renders whatever cached trail/POI/route data exists.
      }
    })();

    return () => {
      active = false;
      watchSub.current?.remove();
    };
  }, [tripIdParam]);

  const hasAnyData = !!(trail?.coordinates?.length || trail?.pois?.length || homestayRoute || userPos);

  const allPoints: { lat: number; lng: number }[] = [
    ...(trail?.coordinates || []),
    ...(trail?.pois || []),
    ...(userPos ? [userPos] : []),
    ...(homestayRoute ? [
      { lat: homestayRoute.fromLat, lng: homestayRoute.fromLng },
      { lat: homestayRoute.homestayLat, lng: homestayRoute.homestayLng },
    ] : []),
  ];
  const bounds = makeBounds(allPoints);
  const canvasW = SCREEN_W - 32;

  const homestayInfo = homestayRoute && userPos
    ? {
        distanceKm: haversineKm(userPos.lat, userPos.lng, homestayRoute.homestayLat, homestayRoute.homestayLng),
        bearing: bearingDeg(userPos.lat, userPos.lng, homestayRoute.homestayLat, homestayRoute.homestayLng),
      }
    : homestayRoute
    ? {
        distanceKm: haversineKm(homestayRoute.fromLat, homestayRoute.fromLng, homestayRoute.homestayLat, homestayRoute.homestayLng),
        bearing: bearingDeg(homestayRoute.fromLat, homestayRoute.fromLng, homestayRoute.homestayLat, homestayRoute.homestayLng),
      }
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Trail View</Text>
          <Text style={styles.headerSub}>Works with zero signal</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {!loaded ? (
        <View style={styles.center}>
          <Text style={styles.noDataText}>Loading offline data…</Text>
        </View>
      ) : !hasAnyData ? (
        <View style={styles.center}>
          <Ionicons name="shield-outline" size={56} color="rgba(255,255,255,0.15)" />
          <Text style={styles.noDataTitle}>No offline data available</Text>
          <Text style={styles.noDataText}>
            Open a trip's map or a homestay while you still have signal — this screen
            shows whatever was cached, even with zero network.
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.canvas, { width: canvasW, height: CANVAS_H }]}>
            {/* Trail line */}
            {trail && trail.coordinates.length > 1 &&
              trail.coordinates.slice(1).map((pt, i) => (
                <LineSegment
                  key={`trail-${i}`}
                  from={project(trail.coordinates[i].lat, trail.coordinates[i].lng, bounds, canvasW, CANVAS_H)}
                  to={project(pt.lat, pt.lng, bounds, canvasW, CANVAS_H)}
                  color={GREEN}
                  thickness={4}
                />
              ))}

            {/* Route to shelter (straight line) */}
            {homestayRoute && (
              <LineSegment
                from={project(userPos?.lat ?? homestayRoute.fromLat, userPos?.lng ?? homestayRoute.fromLng, bounds, canvasW, CANVAS_H)}
                to={project(homestayRoute.homestayLat, homestayRoute.homestayLng, bounds, canvasW, CANVAS_H)}
                color={AMBER}
                thickness={3}
                dashed
              />
            )}

            {/* POI pins */}
            {trail?.pois?.map((poi) => (
              <Pin
                key={poi.id}
                point={project(poi.lat, poi.lng, bounds, canvasW, CANVAS_H)}
                emoji={POI_EMOJI[poi.category] || '📍'}
                color="rgba(255,255,255,0.12)"
                size={24}
                label={poi.name}
              />
            ))}

            {/* Homestay pin */}
            {homestayRoute && (
              <Pin
                point={project(homestayRoute.homestayLat, homestayRoute.homestayLng, bounds, canvasW, CANVAS_H)}
                emoji="🏠"
                color={AMBER}
                size={30}
                label={homestayRoute.homestayName}
              />
            )}

            {/* Trail start */}
            {trail && trail.coordinates.length > 0 && (
              <Pin point={project(trail.coordinates[0].lat, trail.coordinates[0].lng, bounds, canvasW, CANVAS_H)} emoji="🚩" color={GREEN} size={24} />
            )}

            {/* User's live GPS dot — on top of everything else */}
            {userPos && (
              <View
                style={[
                  styles.userDot,
                  { left: project(userPos.lat, userPos.lng, bounds, canvasW, CANVAS_H).x - 9, top: project(userPos.lat, userPos.lng, bounds, canvasW, CANVAS_H).y - 9 },
                ]}
              />
            )}
          </View>

          {/* Info panels */}
          <View style={styles.infoRow}>
            {!userPos && (
              <View style={styles.infoCard}>
                <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.4)" />
                <Text style={styles.infoCardText}>Waiting for GPS fix…</Text>
              </View>
            )}
            {trail && (
              <View style={styles.infoCard}>
                <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
                <Text style={styles.infoCardText} numberOfLines={1}>
                  {trail.tripTitle} · {trail.coordinates.length} recorded points
                </Text>
              </View>
            )}
            {homestayInfo && homestayRoute && (
              <View style={styles.infoCard}>
                <View style={[styles.legendDot, { backgroundColor: AMBER }]} />
                <Text style={styles.infoCardText}>
                  {homestayRoute.homestayName} · {homestayInfo.distanceKm.toFixed(1)} km {compassLabel(homestayInfo.bearing)}
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  headerSub: { color: AMBER, fontSize: 11, fontWeight: '600', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  noDataTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: 4 },
  noDataText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  canvas: {
    alignSelf: 'center', marginTop: 16, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#0D1420', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pin: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(0,0,0,0.3)' },
  pinLabel: {
    color: '#FFF', fontSize: 9, fontWeight: '700', marginTop: 2, maxWidth: 70,
    textAlign: 'center', textShadowColor: '#000', textShadowRadius: 3,
  },
  userDot: {
    position: 'absolute', width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#3B82F6', borderWidth: 3, borderColor: '#FFF',
  },
  infoRow: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  infoCardText: { color: '#FFF', fontSize: 12.5, fontWeight: '600', flex: 1 },
});
