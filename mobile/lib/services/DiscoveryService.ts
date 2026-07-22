import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { fetchExpeditions, type GuidedExpedition } from '../expeditions';
import type { HomestayCardData } from '@/components/adventure/HomestayCard';
import type { GuideCardData } from '@/components/adventure/GuideCard';
import type { RentalCardData } from '@/components/adventure/RentalCard';
import type { AdventureCardData } from '@/components/adventure/AdventureCard';
import type { ListingCardData } from '@/components/adventure/ListingCard';

// ============================================================
// Discovery Engine — Discovery Engine Consolidation milestone.
// ============================================================
// Before this file: the Home tab, Discover tab, and four browse screens
// (homestays, guides, rentals, expeditions) each ran their own supabase
// queries against the listing tables, each wrote its own inline row→card
// mapping, and each reimplemented search/sort/empty-state logic
// separately. That drift is exactly what caused a real, shipped bug this
// project already hit twice: some screens querying legacy `homestays`/
// `rentals` tables while others queried the current `properties`/
// `rental_vehicles` tables.
//
// This file is now the ONLY place that:
//   1. Knows which table backs each listing type (LISTING_TABLE)
//   2. Runs the query for that type (fetch*Rows)
//   3. Maps a raw row to the shape its shared Card component expects
//      (map*Row) — HomestayCard/GuideCard/RentalCard/AdventureCard/
//      ListingCard themselves are unchanged and still owned by
//      components/adventure/*.
//   4. Sorts (sortByKey) and searches (matchesSearch) generically
//   5. Produces consistent empty-state content (discoveryEmptyState)
//   6. Provides one loading/refreshing/error hook (useDiscoveryList)
//
// Every discovery screen calls into this file instead of supabase
// directly. Detail screens (homestay/[id].tsx etc.) are a different
// concern — single-item fetches with far more fields — and are not
// part of this consolidation.

export type ListingType = 'trip' | 'homestay' | 'guide' | 'vehicle' | 'expedition';

// Single source of truth for table names — this is the fix that makes
// the legacy-table class of bug structurally impossible going forward:
// there is now exactly one place a screen can get a table name from.
export const LISTING_TABLE: Record<Exclude<ListingType, 'expedition'>, string> = {
  trip: 'trips',
  homestay: 'properties',
  guide: 'guides',
  vehicle: 'rental_vehicles',
};

export type DiscoverySortKey = 'recent' | 'verified' | 'rating' | 'budget_low' | 'budget_high';

export const SORT_LABELS: Record<DiscoverySortKey, string> = {
  recent: 'Recently Added',
  verified: 'Recently Verified',
  rating: 'Top Rated',
  budget_low: 'Budget: Low to High',
  budget_high: 'Budget: High to Low',
};

// ── Shared budget/duration helpers ───────────────────────────
// Previously duplicated identically in both the Home tab and Discover tab.
export function perPersonBudgetOf(trip: { budget?: number | null; budget_type?: string; group_size?: number | null }): number {
  const budget = trip.budget || 0;
  if (trip.budget_type === 'per_person') return budget;
  return Math.round(budget / (trip.group_size || 1));
}

export function durationLabelOf(start: string, end: string): string | null {
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return days > 0 ? `${days}D/${Math.max(days - 1, 0)}N` : null;
}

// ── Shared search + sort ─────────────────────────────────────
export function matchesSearch(fields: (string | null | undefined)[], query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some((f) => (f || '').toLowerCase().includes(q));
}

interface SortExtractors<T> {
  price?: (item: T) => number | null;
  createdAt?: (item: T) => string;
  verifiedAt?: (item: T) => string | null;
  rating?: (item: T) => number | null;
}

export function sortByKey<T>(items: T[], key: DiscoverySortKey, extract: SortExtractors<T>): T[] {
  const copy = [...items];
  switch (key) {
    case 'budget_low':
      return extract.price ? copy.sort((a, b) => (extract.price!(a) ?? Infinity) - (extract.price!(b) ?? Infinity)) : copy;
    case 'budget_high':
      return extract.price ? copy.sort((a, b) => (extract.price!(b) ?? -Infinity) - (extract.price!(a) ?? -Infinity)) : copy;
    case 'verified':
      return extract.verifiedAt ? copy.sort((a, b) => (extract.verifiedAt!(b) || '').localeCompare(extract.verifiedAt!(a) || '')) : copy;
    case 'rating':
      return extract.rating ? copy.sort((a, b) => (extract.rating!(b) ?? 0) - (extract.rating!(a) ?? 0)) : copy;
    case 'recent':
    default:
      return extract.createdAt ? copy.sort((a, b) => extract.createdAt!(b).localeCompare(extract.createdAt!(a))) : copy;
  }
}

// ── Shared empty-state content ───────────────────────────────
// Every screen previously invented its own icon/wording per type. One
// canonical set, still fed into the same shared EmptyState component.
const EMPTY_STATE_BASE: Record<ListingType, { icon: string; noun: string }> = {
  trip: { icon: 'trail-sign-outline', noun: 'treks' },
  homestay: { icon: 'home-outline', noun: 'homestays' },
  guide: { icon: 'compass-outline', noun: 'guides' },
  vehicle: { icon: 'car-outline', noun: 'vehicles' },
  expedition: { icon: 'flag-outline', noun: 'expeditions' },
};

export function discoveryEmptyState(type: ListingType, hasActiveFilters: boolean): { icon: string; title: string; subtitle: string } {
  const { icon, noun } = EMPTY_STATE_BASE[type];
  return hasActiveFilters
    ? { icon, title: `No ${noun} match yet`, subtitle: 'Try a broader search or clear your filters.' }
    : { icon, title: `No ${noun} listed yet`, subtitle: 'Check back soon — new listings are added regularly.' };
}

// ── Shared loading/refreshing/error state ────────────────────
// Replaces each screen's own hand-rolled useState(loading)/useState
// (refreshing)/try-catch triplet with one hook.
export function useDiscoveryList<T>(fetcher: () => Promise<T[]>, deps: unknown[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      setData(await fetcher());
    } catch (e) {
      console.error(`Discovery load failed:`, e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  return { data, loading, refreshing, error, reload: load, onRefresh };
}

// ============================================================
// Homestays (`properties`)
// ============================================================
// Superset select covering every current call site (Home tab, Discover
// tab, /homestays browse, NearbyService) — one query shape instead of
// four slightly different ones against the same table.
const HOMESTAY_SELECT = 'id, name, city, state, photos, amenities, property_type, status, created_at, approved_at, lat, lng, room_types(base_price)';

export interface HomestayListItem extends HomestayCardData {
  createdAt: string;
  approvedAt: string | null;
  propertyType: string[];
  lat: number | null;
  lng: number | null;
}

export async function fetchHomestayRows(limit = 100): Promise<HomestayListItem[]> {
  const { data } = await supabase
    .from(LISTING_TABLE.homestay)
    .select(HOMESTAY_SELECT)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);
  return ((data as any[]) || []).map(mapHomestayRow);
}

export function mapHomestayRow(h: any): HomestayListItem {
  const basePrices = (h.room_types || []).map((r: any) => r.base_price).filter((p: any) => typeof p === 'number');
  return {
    id: h.id,
    image: Array.isArray(h.photos) ? h.photos[0] : null,
    name: h.name,
    location: [h.city, h.state].filter(Boolean).join(', '),
    pricePerNight: basePrices.length > 0 ? Math.min(...basePrices) : null,
    rating: null, // no rating column exists on `properties` — not fabricated
    amenities: Array.isArray(h.amenities) ? h.amenities : null,
    verified: h.status === 'approved',
    createdAt: h.created_at,
    approvedAt: h.approved_at ?? null,
    propertyType: Array.isArray(h.property_type) ? h.property_type : [],
    lat: h.lat ?? null,
    lng: h.lng ?? null,
  };
}

// ============================================================
// Guides (`guides`)
// ============================================================
const GUIDE_SELECT = 'id, name, full_name, location, locations, specializations, languages, experience_years, rating, total_reviews, rate_per_day, photo_url, profile_photo_url, status, verified_at, created_at';

export interface GuideListItem extends GuideCardData {
  createdAt: string;
  verifiedAt: string | null;
  locations: { name: string; lat: number; lng: number; radius_km: number; rate_per_day: number }[];
}

export async function fetchGuideRows(limit = 100): Promise<GuideListItem[]> {
  const { data } = await supabase
    .from(LISTING_TABLE.guide)
    .select(GUIDE_SELECT)
    .eq('status', 'approved')
    .order('rating', { ascending: false })
    .limit(limit);
  return ((data as any[]) || []).map(mapGuideRow);
}

export function mapGuideRow(g: any): GuideListItem {
  return {
    id: g.id,
    photoUrl: g.photo_url || g.profile_photo_url,
    name: g.full_name || g.name,
    location: g.location,
    languages: Array.isArray(g.languages) ? g.languages : null,
    experienceYears: g.experience_years,
    treksCompleted: null,
    rating: g.rating,
    totalReviews: g.total_reviews,
    verified: g.status === 'approved' || !!g.verified_at,
    ratePerDay: g.rate_per_day,
    createdAt: g.created_at,
    verifiedAt: g.verified_at ?? null,
    locations: Array.isArray(g.locations) ? g.locations : [],
  };
}

// ============================================================
// Rental vehicles (`rental_vehicles`)
// ============================================================
const VEHICLE_SELECT = 'id, make, model, vehicle_type, price_per_day, photos, images, location, status, is_available, lat, lng, created_at';

export interface VehicleListItem extends RentalCardData {
  createdAt: string;
  vehicleType: string;
  lat: number | null;
  lng: number | null;
}

export async function fetchVehicleRows(limit = 100): Promise<VehicleListItem[]> {
  const { data } = await supabase
    .from(LISTING_TABLE.vehicle)
    .select(VEHICLE_SELECT)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);
  return ((data as any[]) || []).map(mapVehicleRow);
}

export function mapVehicleRow(v: any): VehicleListItem {
  const photos: string[] = Array.isArray(v.images) && v.images.length > 0 ? v.images : (Array.isArray(v.photos) ? v.photos : []);
  return {
    id: v.id,
    image: photos[0] || null,
    title: [v.make, v.model].filter(Boolean).join(' ') || v.vehicle_type,
    location: v.location,
    pricePerDay: v.price_per_day,
    available: !!v.is_available,
    verified: v.status === 'approved',
    createdAt: v.created_at,
    vehicleType: v.vehicle_type,
    lat: v.lat ?? null,
    lng: v.lng ?? null,
  };
}

// ============================================================
// Trips (`trips`)
// ============================================================
const TRIP_SELECT = 'id, title, destination, cover_photo_url, photos, experience_level, start_date, end_date, budget, budget_type, group_size, looking_for_partner, created_at, creator:users!created_by(full_name, avatar_url)';

export async function fetchTripRows(opts: { featured?: boolean; limit?: number } = {}): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  let query = supabase
    .from(LISTING_TABLE.trip)
    .select(TRIP_SELECT)
    .eq('is_public', true)
    .in('status', ['planning', 'confirmed'])
    .gte('end_date', today)
    .order('start_date', { ascending: true })
    .limit(opts.limit ?? 20);
  if (opts.featured !== undefined) query = query.eq('is_featured', opts.featured);
  const { data } = await query;
  return (data as any[]) || [];
}

export function mapTripToAdventureCard(t: any): AdventureCardData {
  return {
    id: t.id,
    image: t.cover_photo_url || (Array.isArray(t.photos) ? t.photos[0] : null),
    title: t.title,
    location: t.destination,
    difficulty: t.experience_level,
    distanceKm: null,
    durationLabel: durationLabelOf(t.start_date, t.end_date),
    rating: null,
    startingPrice: perPersonBudgetOf(t) || null,
  };
}

export function mapTripToListingCard(t: any, badgeLabel = 'Recommended'): ListingCardData {
  return {
    id: t.id,
    image: t.cover_photo_url || (Array.isArray(t.photos) ? t.photos[0] : null),
    title: t.title,
    subtitle: t.destination,
    badgeLabel,
  };
}

// ============================================================
// Guided expeditions (`guided_expeditions`)
// ============================================================
// Reuses the existing fetchExpeditions() from lib/expeditions.ts rather
// than re-querying — that function already joins guide + packages
// correctly; duplicating it here would be exactly the kind of parallel
// query this milestone exists to remove.
export async function fetchExpeditionRows(filters?: { difficulty?: string; destination?: string }): Promise<GuidedExpedition[]> {
  const { data } = await fetchExpeditions(filters);
  return data || [];
}

export function minExpeditionPackagePrice(expedition: GuidedExpedition): number | null {
  const prices = (expedition.packages || []).map((p) => p.price_per_person).filter((p): p is number => typeof p === 'number');
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function mapExpeditionToListingCard(e: GuidedExpedition): ListingCardData {
  return {
    id: e.id,
    image: e.cover_photos?.[0] || null,
    title: e.title,
    subtitle: e.destination,
    badgeLabel: e.difficulty ? e.difficulty.charAt(0).toUpperCase() + e.difficulty.slice(1) : undefined,
  };
}
