import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key is server-side only — mobile calls our own Next.js proxy
const WEATHER_PROXY_URL = process.env.EXPO_PUBLIC_WEB_API_URL
  ? `${process.env.EXPO_PUBLIC_WEB_API_URL}/api/weather`
  : 'https://trekriderz.vercel.app/api/weather';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_KEY_PREFIX = 'weather_cache_';
const CACHE_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours

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
}

/**
 * Fetch detailed weather using coordinates with 24h caching
 */
export async function fetchWeatherByCoords(lat: number, lng: number): Promise<WeatherData | null> {
  const cacheKey = `${CACHE_KEY_PREFIX}${lat.toFixed(2)}_${lng.toFixed(2)}`;

  try {
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      const { timestamp, data } = JSON.parse(cachedData);
      if (Date.now() - timestamp < CACHE_EXPIRY) return data;
    }

    // Call our own Next.js proxy — API key never leaves the server
    const res = await fetch(`${WEATHER_PROXY_URL}?lat=${lat}&lng=${lng}`);
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

    await AsyncStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: weatherData }));
    return weatherData;
  } catch (error) {
    console.error('Error fetching weather:', error);
    // Fallback to Open-Meteo if proxy unavailable
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
  const cacheKey = `${CACHE_KEY_PREFIX}om_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) return data;
    }

    const res = await fetch(
      `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lng}&current_weather=true` +
      `&daily=temperature_2m_max,weathercode&timezone=auto&forecast_days=4`
    );
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

    await AsyncStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: weatherData }));
    return weatherData;
  } catch (error) {
    console.error('Open-Meteo error:', error);
    return null;
  }
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
