import { supabase } from '../supabase';
import { haversineKm } from '../offline-safety';
import type { ListingCardData } from '@/components/adventure/ListingCard';

// Traveller Discovery Experience — "Nearby experiences" for listing
// detail pages. No PostGIS/geospatial DB layer exists in this project
// (confirmed: app/map/[tripId].tsx already does plain-JS distance
// matching for the same reason) — this reuses the exact haversineKm
// helper already built for offline safety-shelter routing, just applied
// to discovery instead. Candidate rows come from one bounded query per
// listing type (not per-row), then distance is computed and sorted
// client-side, matching the "avoid duplicate queries" requirement.

export type NearbyType = 'homestay' | 'guide' | 'vehicle' | 'expedition';

export interface NearbyItem extends ListingCardData {
  type: NearbyType;
  distanceKm: number;
}

const RADIUS_KM = 50;
const CANDIDATE_LIMIT = 40;
const RESULT_LIMIT = 6;

interface Options {
  lat: number;
  lng: number;
  excludeType?: NearbyType;
  excludeId?: string;
}

export async function fetchNearbyExperiences({ lat, lng, excludeType, excludeId }: Options): Promise<NearbyItem[]> {
  const [homestaysRes, guidesRes, vehiclesRes, expeditionsRes] = await Promise.all([
    supabase.from('properties').select('id, name, city, state, photos, lat, lng, status').eq('status', 'approved').limit(CANDIDATE_LIMIT),
    supabase.from('guides').select('id, name, full_name, photo_url, profile_photo_url, locations, rate_per_day, status').eq('status', 'approved').limit(CANDIDATE_LIMIT),
    supabase.from('rental_vehicles').select('id, make, model, photos, images, location, lat, lng, price_per_day, status').eq('status', 'approved').limit(CANDIDATE_LIMIT),
    supabase.from('guided_expeditions').select('id, title, destination, cover_photos, lat, lng, status').eq('status', 'published').limit(CANDIDATE_LIMIT),
  ]);

  const items: NearbyItem[] = [];

  for (const h of (homestaysRes.data || []) as any[]) {
    if (excludeType === 'homestay' && excludeId === h.id) continue;
    if (h.lat == null || h.lng == null) continue;
    const distanceKm = haversineKm(lat, lng, Number(h.lat), Number(h.lng));
    if (distanceKm > RADIUS_KM) continue;
    items.push({
      id: h.id, type: 'homestay', distanceKm,
      image: Array.isArray(h.photos) ? h.photos[0] : null,
      title: h.name, subtitle: `${distanceKm.toFixed(1)} km away · ${[h.city, h.state].filter(Boolean).join(', ')}`,
      badgeLabel: 'Homestay',
    });
  }

  for (const g of (guidesRes.data || []) as any[]) {
    if (excludeType === 'guide' && excludeId === g.id) continue;
    const locations = Array.isArray(g.locations) ? g.locations : [];
    const distances = locations
      .filter((l: any) => l.lat != null && l.lng != null)
      .map((l: any) => haversineKm(lat, lng, Number(l.lat), Number(l.lng)));
    if (distances.length === 0) continue;
    const distanceKm = Math.min(...distances);
    if (distanceKm > RADIUS_KM) continue;
    const name = g.full_name || g.name || 'Guide';
    items.push({
      id: g.id, type: 'guide', distanceKm,
      image: g.photo_url || g.profile_photo_url || null,
      title: name, subtitle: `${distanceKm.toFixed(1)} km away${g.rate_per_day ? ` · ₹${g.rate_per_day.toLocaleString('en-IN')}/day` : ''}`,
      badgeLabel: 'Guide',
    });
  }

  for (const v of (vehiclesRes.data || []) as any[]) {
    if (excludeType === 'vehicle' && excludeId === v.id) continue;
    if (v.lat == null || v.lng == null) continue;
    const distanceKm = haversineKm(lat, lng, Number(v.lat), Number(v.lng));
    if (distanceKm > RADIUS_KM) continue;
    const photos: string[] = Array.isArray(v.images) && v.images.length > 0 ? v.images : (Array.isArray(v.photos) ? v.photos : []);
    items.push({
      id: v.id, type: 'vehicle', distanceKm,
      image: photos[0] || null,
      title: [v.make, v.model].filter(Boolean).join(' ') || 'Rental vehicle',
      subtitle: `${distanceKm.toFixed(1)} km away · ₹${(v.price_per_day || 0).toLocaleString('en-IN')}/day`,
      badgeLabel: 'Rental',
    });
  }

  for (const e of (expeditionsRes.data || []) as any[]) {
    if (excludeType === 'expedition' && excludeId === e.id) continue;
    if (e.lat == null || e.lng == null) continue;
    const distanceKm = haversineKm(lat, lng, Number(e.lat), Number(e.lng));
    if (distanceKm > RADIUS_KM) continue;
    items.push({
      id: e.id, type: 'expedition', distanceKm,
      image: Array.isArray(e.cover_photos) ? e.cover_photos[0] : null,
      title: e.title, subtitle: `${distanceKm.toFixed(1)} km away · ${e.destination || ''}`,
      badgeLabel: 'Expedition',
    });
  }

  return items.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, RESULT_LIMIT);
}

export function routeForNearbyItem(item: NearbyItem): string {
  switch (item.type) {
    case 'homestay': return `/homestay/${item.id}`;
    case 'guide': return `/guide/${item.id}`;
    case 'vehicle': return `/rentals/${item.id}`;
    case 'expedition': return `/expeditions/${item.id}`;
  }
}
