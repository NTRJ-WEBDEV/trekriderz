import { supabase } from '../supabase';

// The reusable search entry point mobile/components/ui/SearchBar.tsx's own
// comment says it's "ready to point at a real search endpoint" for — this
// is that endpoint. New entity types register a config row below instead
// of a new bespoke query at each call site. Plain ILIKE across confirmed
// column names, not a ranked full-text index; sufficient at today's data
// volume, and swapping in Postgres full-text search later only touches
// this file.
export type SearchEntityType = 'trips' | 'communities' | 'rental_vehicles' | 'users';

export interface SearchResult {
  entityType: SearchEntityType;
  id: string;
  title: string;
  subtitle?: string;
}

const ENTITY_CONFIG: Record<SearchEntityType, { table: string; select: string; searchCols: string[]; toResult: (row: any) => Omit<SearchResult, 'entityType'> }> = {
  trips: {
    table: 'trips',
    select: 'id, title, destination',
    searchCols: ['title', 'destination'],
    toResult: (row) => ({ id: row.id, title: row.title, subtitle: row.destination }),
  },
  communities: {
    table: 'communities',
    select: 'id, name, category',
    searchCols: ['name'],
    toResult: (row) => ({ id: row.id, title: row.name, subtitle: row.category }),
  },
  rental_vehicles: {
    table: 'rental_vehicles',
    select: 'id, make, model, vehicle_type',
    searchCols: ['make', 'model'],
    toResult: (row) => ({ id: row.id, title: [row.make, row.model].filter(Boolean).join(' ') || row.vehicle_type, subtitle: row.vehicle_type }),
  },
  users: {
    table: 'users',
    select: 'id, full_name, email',
    searchCols: ['full_name', 'email'],
    toResult: (row) => ({ id: row.id, title: row.full_name || row.email, subtitle: row.email }),
  },
};

export async function search(query: string, entityTypes?: SearchEntityType[]): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const types = entityTypes && entityTypes.length ? entityTypes : (Object.keys(ENTITY_CONFIG) as SearchEntityType[]);

  const resultsPerType = await Promise.all(types.map(async (type) => {
    const cfg = ENTITY_CONFIG[type];
    const orFilter = cfg.searchCols.map((col) => `${col}.ilike.%${trimmed}%`).join(',');
    const { data } = await supabase.from(cfg.table).select(cfg.select).or(orFilter).limit(10);
    return (data || []).map((row: any) => ({ entityType: type, ...cfg.toResult(row) }));
  }));

  return resultsPerType.flat();
}
