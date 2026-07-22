import { haversineKm } from '../offline-safety';
import type { ListingCardData } from '@/components/adventure/ListingCard';
import {
  fetchHomestayRows, fetchGuideRows, fetchVehicleRows, fetchExpeditionRows,
  mapExpeditionToListingCard,
} from './DiscoveryService';

// Traveller Discovery Experience — "Nearby experiences" for listing
// detail pages. No PostGIS/geospatial DB layer exists in this project
// (confirmed: app/map/[tripId].tsx already does plain-JS distance
// matching for the same reason) — this reuses the exact haversineKm
// helper already built for offline safety-shelter routing, just applied
// to discovery instead.
//
// Discovery Engine Consolidation update: candidate rows now come from
// DiscoveryService's own fetchers/mappers (fetchHomestayRows,
// fetchGuideRows, fetchVehicleRows, fetchExpeditionRows) instead of this
// file running its own separate select() calls against the same four
// tables — one less place that could drift onto a stale table or a
// different column set than everywhere else.

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
  const [homestays, guides, vehicles, expeditions] = await Promise.all([
    fetchHomestayRows(CANDIDATE_LIMIT),
    fetchGuideRows(CANDIDATE_LIMIT),
    fetchVehicleRows(CANDIDATE_LIMIT),
    fetchExpeditionRows(),
  ]);

  const items: NearbyItem[] = [];

  for (const h of homestays) {
    if (excludeType === 'homestay' && excludeId === h.id) continue;
    if (h.lat == null || h.lng == null) continue;
    const distanceKm = haversineKm(lat, lng, Number(h.lat), Number(h.lng));
    if (distanceKm > RADIUS_KM) continue;
    items.push({
      id: h.id, type: 'homestay', distanceKm,
      image: h.image, title: h.name, subtitle: `${distanceKm.toFixed(1)} km away · ${h.location}`,
      badgeLabel: 'Homestay',
    });
  }

  for (const g of guides) {
    if (excludeType === 'guide' && excludeId === g.id) continue;
    const distances = g.locations
      .filter((l) => l.lat != null && l.lng != null)
      .map((l) => haversineKm(lat, lng, Number(l.lat), Number(l.lng)));
    if (distances.length === 0) continue;
    const distanceKm = Math.min(...distances);
    if (distanceKm > RADIUS_KM) continue;
    items.push({
      id: g.id, type: 'guide', distanceKm,
      image: g.photoUrl, title: g.name,
      subtitle: `${distanceKm.toFixed(1)} km away${g.ratePerDay ? ` · ₹${g.ratePerDay.toLocaleString('en-IN')}/day` : ''}`,
      badgeLabel: 'Guide',
    });
  }

  for (const v of vehicles) {
    if (excludeType === 'vehicle' && excludeId === v.id) continue;
    if (v.lat == null || v.lng == null) continue;
    const distanceKm = haversineKm(lat, lng, Number(v.lat), Number(v.lng));
    if (distanceKm > RADIUS_KM) continue;
    items.push({
      id: v.id, type: 'vehicle', distanceKm,
      image: v.image, title: v.title,
      subtitle: `${distanceKm.toFixed(1)} km away · ₹${(v.pricePerDay || 0).toLocaleString('en-IN')}/day`,
      badgeLabel: 'Rental',
    });
  }

  for (const e of expeditions) {
    if (excludeType === 'expedition' && excludeId === e.id) continue;
    if (e.lat == null || e.lng == null) continue;
    const distanceKm = haversineKm(lat, lng, Number(e.lat), Number(e.lng));
    if (distanceKm > RADIUS_KM) continue;
    const card = mapExpeditionToListingCard(e);
    items.push({ ...card, id: e.id, type: 'expedition', distanceKm, subtitle: `${distanceKm.toFixed(1)} km away · ${e.destination || ''}` });
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
