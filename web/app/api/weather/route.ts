import { NextRequest, NextResponse } from 'next/server';

// Key lives server-side only — never in the APK
const OW_KEY = process.env.OPENWEATHER_API_KEY || '';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  if (!OW_KEY) {
    return NextResponse.json({ error: 'Weather service not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${OW_KEY}&units=metric`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) throw new Error(`OpenWeather error: ${res.status}`);
    const json = await res.json();

    const list: any[] = json.list;
    const current = list[0];

    const forecast: Array<{ day: string; temp: number; icon: string }> = [];
    const seen = new Set<string>();
    const today = new Date().toDateString();

    for (const item of list) {
      const date = new Date(item.dt * 1000);
      const dayStr = date.toDateString();
      if (dayStr !== today && !seen.has(dayStr) && date.getHours() >= 12 && forecast.length < 3) {
        seen.add(dayStr);
        forecast.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          temp: Math.round(item.main.temp),
          icon: item.weather[0].icon,
        });
      }
    }

    return NextResponse.json({
      currentTemp: Math.round(current.main.temp),
      condition: current.weather[0].main,
      icon: current.weather[0].icon,
      humidity: current.main.humidity,
      wind: Math.round(current.wind.speed * 3.6),
      forecast,
    });
  } catch (error) {
    console.error('Weather proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
