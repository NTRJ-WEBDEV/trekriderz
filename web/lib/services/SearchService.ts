import { createClient } from '@/lib/supabase';

// Mirrors mobile/lib/services/SearchService.ts — same shape, same
// principle (one reusable entry point, config-driven, plain ILIKE).
// Extended in Phase 3 to cover every entity the new admin modules
// manage, so the AdminShell global search bar and any future
// module-specific search box both call this one function.
export type SearchEntityType =
  | 'trips' | 'stories' | 'vehicles' | 'places' | 'pois'
  | 'users' | 'guides' | 'homestays' | 'rentals' | 'communities' | 'expeditions' | 'posts';

export interface SearchResult {
  entityType: SearchEntityType;
  id: string;
  title: string;
  subtitle?: string;
  route: string;
}

const ENTITY_CONFIG: Record<SearchEntityType, { table: string; select: string; searchCols: string[]; toResult: (row: any) => Omit<SearchResult, 'entityType'> }> = {
  trips: {
    table: 'trips',
    select: 'id, title, destination',
    searchCols: ['title', 'destination'],
    toResult: (row) => ({ id: row.id, title: row.title, subtitle: row.destination, route: `/admin/trips` }),
  },
  stories: {
    table: 'stories',
    select: 'id, title, status',
    searchCols: ['title'],
    toResult: (row) => ({ id: row.id, title: row.title, subtitle: row.status, route: `/admin/stories` }),
  },
  vehicles: {
    table: 'cms_vehicles',
    select: 'id, name, type',
    searchCols: ['name', 'type'],
    toResult: (row) => ({ id: row.id, title: row.name, subtitle: row.type, route: `/admin/vehicles` }),
  },
  places: {
    table: 'places_guide',
    select: 'id, name',
    searchCols: ['name'],
    toResult: (row) => ({ id: row.id, title: row.name, route: `/admin/places` }),
  },
  pois: {
    table: 'pois',
    select: 'id, name, category',
    searchCols: ['name'],
    toResult: (row) => ({ id: row.id, title: row.name, subtitle: row.category, route: `/admin/pois` }),
  },
  users: {
    table: 'users',
    select: 'id, full_name, email',
    searchCols: ['full_name', 'email'],
    toResult: (row) => ({ id: row.id, title: row.full_name || row.email, subtitle: row.email, route: `/admin/users` }),
  },
  guides: {
    table: 'guides',
    select: 'id, name, full_name, location',
    searchCols: ['name', 'full_name', 'location'],
    toResult: (row) => ({ id: row.id, title: row.full_name || row.name, subtitle: row.location, route: `/admin/guides` }),
  },
  homestays: {
    table: 'properties',
    select: 'id, name, city',
    searchCols: ['name', 'city'],
    toResult: (row) => ({ id: row.id, title: row.name, subtitle: row.city, route: `/admin/homestays` }),
  },
  rentals: {
    table: 'rental_vehicles',
    select: 'id, make, model, vehicle_type',
    searchCols: ['make', 'model'],
    toResult: (row) => ({ id: row.id, title: [row.make, row.model].filter(Boolean).join(' ') || row.vehicle_type, subtitle: row.vehicle_type, route: `/admin/rentals` }),
  },
  communities: {
    table: 'communities',
    select: 'id, name, category',
    searchCols: ['name'],
    toResult: (row) => ({ id: row.id, title: row.name, subtitle: row.category, route: `/admin/communities` }),
  },
  expeditions: {
    table: 'guided_expeditions',
    select: 'id, title, destination',
    searchCols: ['title', 'destination'],
    toResult: (row) => ({ id: row.id, title: row.title, subtitle: row.destination, route: `/admin/expeditions` }),
  },
  posts: {
    table: 'posts',
    select: 'id, content, post_type',
    searchCols: ['content'],
    toResult: (row) => ({ id: row.id, title: (row.content || '').slice(0, 60) || '(no caption)', subtitle: row.post_type || 'post', route: `/admin/moderation` }),
  },
};

export async function search(query: string, entityTypes?: SearchEntityType[]): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const supabase = createClient();
  const types = entityTypes && entityTypes.length ? entityTypes : (Object.keys(ENTITY_CONFIG) as SearchEntityType[]);

  const resultsPerType = await Promise.all(types.map(async (type) => {
    const cfg = ENTITY_CONFIG[type];
    const orFilter = cfg.searchCols.map((col) => `${col}.ilike.%${trimmed}%`).join(',');
    const { data } = await supabase.from(cfg.table).select(cfg.select).or(orFilter).limit(6);
    return (data || []).map((row: any) => ({ entityType: type, ...cfg.toResult(row) }));
  }));

  return resultsPerType.flat();
}
