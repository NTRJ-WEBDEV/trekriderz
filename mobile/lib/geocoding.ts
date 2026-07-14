const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export interface GeocodeResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: any[];
  place_type?: string[];
}

// All nine place types the v5 Geocoding API actually supports. The previous
// list (place,address,poi) silently dropped every region/district/locality/
// neighborhood match — confirmed live: "Coorg" and "Kodagu" both resolve to
// Kodagu district (place_type: "district") in Mapbox's own index, "Kudremukh"
// and "Mullayanagiri" resolve as "locality", and "Delhi" resolves as "region"
// — none of which could ever surface through the old whitelist, regardless
// of how the query matched.
const ALL_PLACE_TYPES = 'country,region,postcode,district,place,locality,neighborhood,address,poi';

/**
 * Forward Geocoding: Address to Coordinates
 *
 * `proximity` biases results toward a [lng, lat] point (e.g. a state's
 * center once the user has picked one via LocationPicker). Left omitted
 * when not provided — a prior hardcoded Delhi-centered fallback was
 * skewing rankings toward North India for any query without an explicit
 * proximity, confirmed live: "Bangalore" surfaced only unrelated address
 * matches near Delhi/Chennai ahead of the actual city.
 */
export async function searchPlaces(query: string, proximity?: [number, number]): Promise<GeocodeResult[]> {
  if (!query || query.length < 3) return [];

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      limit: '8',
      types: ALL_PLACE_TYPES,
      country: 'IN',
      language: 'en',
      autocomplete: 'true',
    });
    if (proximity) params.set('proximity', `${proximity[0]},${proximity[1]}`);

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;

    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.features) {
      console.error('Geocoding error:', data.message || response.statusText);
      return [];
    }

    return data.features.map((f: any) => ({
      id: f.id,
      place_name: f.place_name,
      center: f.center,
      context: f.context,
      place_type: f.place_type,
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

/**
 * Reverse Geocoding: Coordinates to Address
 */
export async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&types=${ALL_PLACE_TYPES}&country=IN&language=en`;

    const response = await fetch(url);
    const data = await response.json();

    return data.features?.[0]?.place_name || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}
