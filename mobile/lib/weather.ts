import AsyncStorage from '@react-native-async-storage/async-storage';

// Key is server-side only — mobile calls our own Next.js proxy
const WEATHER_PROXY_URL = process.env.EXPO_PUBLIC_WEB_API_URL
  ? `${process.env.EXPO_PUBLIC_WEB_API_URL}/api/weather`
  : 'https://trekriderz.vercel.app/api/weather';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_KEY_PREFIX = 'weather_cache_';
// How recent a cached entry must be to skip a live fetch entirely — a
// freshness optimization, not an eviction rule. Entries older than this are
// never deleted; they're always what gets served if a live fetch fails.
const FRESH_WINDOW = 3 * 60 * 60 * 1000; // 3 hours
// A hung request (no response, not even an error) would otherwise never hit
// the catch block that falls back to cache — bound it explicitly.
const FETCH_TIMEOUT_MS = 8000;

function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

export interface WeatherData {
  currentTemp: number;
  condition: string;
  icon: string;
  humidity: number;
  wind: number;
  forecast: Array<{
    day: string;
    temp: number;
    icon: string;
  }>;
  /** True when this payload was served from cache because a live fetch failed
   *  (not merely because it was within the freshness window). */
  isStale?: boolean;
  /** Epoch ms this data was actually fetched from the network. */
  fetchedAt?: number;
}

/**
 * Human-readable cache age, for "Last updated Xh ago" style UI copy.
 */
export function formatWeatherAge(fetchedAt: number): string {
  const diffMs = Date.now() - fetchedAt;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ── Shared "last known good" cache — one implementation, used by every provider ──

interface CacheEnvelope {
  timestamp: number;
  data: WeatherData;
}

function cacheKeyFor(provider: 'proxy' | 'om', lat: number, lng: number): string {
  return `${CACHE_KEY_PREFIX}${provider}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

async function readWeatherCache(key: string): Promise<CacheEnvelope | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheEnvelope) : null;
  } catch (error) {
    console.error('Weather cache read error:', error);
    return null;
  }
}

async function writeWeatherCache(key: string, data: WeatherData): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data } as CacheEnvelope));
  } catch (error) {
    console.error('Weather cache write error:', error);
  }
}

function withMeta(data: WeatherData, fetchedAt: number, isStale: boolean): WeatherData {
  return { ...data, isStale, fetchedAt };
}

// ── OpenWeatherMap via server proxy (key stays server-side) ────────────────

function getIconName(iconCode: string): string {
  const map: Record<string, string> = {
    '01d': 'sunny', '01n': 'moon', '02d': 'partly-sunny', '02n': 'cloudy-night',
    '03d': 'cloudy', '03n': 'cloudy', '04d': 'cloudy', '04n': 'cloudy',
    '09d': 'rainy', '09n': 'rainy', '10d': 'rainy', '10n': 'rainy',
    '11d': 'thunderstorm', '11n': 'thunderstorm', '13d': 'snow', '13n': 'snow',
    '50d': 'help-circle-outline', '50n': 'help-circle-outline'
  };
  return map[iconCode] || 'cloud-outline';
}

/**
 * Fetch detailed weather using coordinates, backed by a persistent
 * last-known-good cache. Never returns null while ANY cached entry exists
 * for this coordinate — only when there is truly nothing cached and no
 * provider (including the Open-Meteo fallback) can be reached.
 */
export async function fetchWeatherByCoords(lat: number, lng: number): Promise<WeatherData | null> {
  const key = cacheKeyFor('proxy', lat, lng);
  const cached = await readWeatherCache(key);

  if (cached && Date.now() - cached.timestamp < FRESH_WINDOW) {
    return withMeta(cached.data, cached.timestamp, false);
  }

  try {
    // Call our own Next.js proxy — API key never leaves the server
    const res = await fetchWithTimeout(`${WEATHER_PROXY_URL}?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error(`Proxy error ${res.status}`);
    const json = await res.json();

    const weatherData: WeatherData = {
      currentTemp: json.currentTemp,
      condition: json.condition,
      icon: getIconName(json.icon),
      humidity: json.humidity,
      wind: json.wind,
      forecast: (json.forecast || []).map((f: any) => ({
        day: f.day,
        temp: f.temp,
        icon: getIconName(f.icon),
      })),
    };

    await writeWeatherCache(key, weatherData);
    return withMeta(weatherData, Date.now(), false);
  } catch (error) {
    console.error('Error fetching weather:', error);
    if (cached) {
      return withMeta(cached.data, cached.timestamp, true);
    }
    // No cache at all for this coordinate under this provider — fall back
    // to Open-Meteo, which has its own fresh/stale/null handling.
    return fetchWeatherOpenMeteo(lat, lng);
  }
}

// ── Open-Meteo (free, no API key) ──────────────────────────────────────────

function wmoToIcon(code: number): string {
  if (code === 0) return 'sunny';
  if (code <= 2) return 'partly-sunny';
  if (code === 3) return 'cloudy';
  if (code <= 48) return 'cloud-outline';
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rainy';
  return 'thunderstorm';
}

function wmoToCondition(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowfall';
  if (code <= 82) return 'Showers';
  return 'Thunderstorm';
}

export async function fetchWeatherOpenMeteo(lat: number, lng: number): Promise<WeatherData | null> {
  const key = cacheKeyFor('om', lat, lng);
  const cached = await readWeatherCache(key);

  if (cached && Date.now() - cached.timestamp < FRESH_WINDOW) {
    return withMeta(cached.data, cached.timestamp, false);
  }

  try {
    const res = await fetchWithTimeout(
      `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lng}&current_weather=true` +
      `&daily=temperature_2m_max,weathercode&timezone=auto&forecast_days=4`
    );
    if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
    const json = await res.json();
    const cw = json.current_weather;
    const daily = json.daily || {};

    const forecast = (daily.time || []).slice(1, 4).map((day: string, i: number) => ({
      day: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
      temp: Math.round((daily.temperature_2m_max || [])[i + 1] ?? cw.temperature),
      icon: wmoToIcon((daily.weathercode || [])[i + 1] ?? cw.weathercode),
    }));

    const weatherData: WeatherData = {
      currentTemp: Math.round(cw.temperature),
      condition: wmoToCondition(cw.weathercode),
      icon: wmoToIcon(cw.weathercode),
      humidity: 0,
      wind: Math.round(cw.windspeed),
      forecast,
    };

    await writeWeatherCache(key, weatherData);
    return withMeta(weatherData, Date.now(), false);
  } catch (error) {
    console.error('Open-Meteo error:', error);
    if (cached) {
      return withMeta(cached.data, cached.timestamp, true);
    }
    return null;
  }
}
