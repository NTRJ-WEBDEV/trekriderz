const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export interface GeocodeResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: any[];
}

/**
 * Forward Geocoding: Address to Coordinates
 *
 * `proximity` biases results toward a [lng, lat] point (e.g. a state's
 * center once the user has picked one via LocationPicker) — falls back to
 * a Delhi-centered bias when omitted, same as before.
 */
export async function searchPlaces(query: string, proximity?: [number, number]): Promise<GeocodeResult[]> {
  if (!query || query.length < 3) return [];

  try {
    const [proxLng, proxLat] = proximity || [77.1025, 28.7041];
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=5&types=place,address,poi&country=IN&proximity=${proxLng},${proxLat}`; // Restricted to India

    const response = await fetch(url);
    const data = await response.json();

    return data.features.map((f: any) => ({
      id: f.id,
      place_name: f.place_name,
      center: f.center,
      context: f.context,
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
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&types=place,address&country=IN`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.features?.[0]?.place_name || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}
