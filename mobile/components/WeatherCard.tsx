import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchWeatherByCoords, formatWeatherAge, WeatherData } from '@/lib/weather';

interface WeatherCardProps {
  lat: number;
  lng: number;
  locationName: string;
}

export default function WeatherCard({ lat, lng, locationName }: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWeather = async () => {
      const data = await fetchWeatherByCoords(lat, lng);
      setWeather(data);
      setLoading(false);
    };
    loadWeather();
  }, [lat, lng]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#8CC63F" />
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={styles.card}>
        <Text style={styles.noData}>No weather data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.location}>{locationName}</Text>
          <Text style={styles.condition}>{weather.condition}</Text>
          {weather.isStale && weather.fetchedAt && (
            <Text style={styles.staleText}>Last updated {formatWeatherAge(weather.fetchedAt)}</Text>
          )}
        </View>
        <Text style={styles.temp}>{weather.currentTemp}°C</Text>
      </View>

      <View style={styles.details}>
        <DetailItem icon="water-outline" value={`${weather.humidity}%`} label="Humidity" />
        <DetailItem icon="leaf-outline" value={`${weather.wind} km/h`} label="Wind" />
      </View>

      <View style={styles.divider} />

      <View style={styles.forecastContainer}>
        {weather.forecast.map((day, idx) => (
          <View key={idx} style={styles.forecastItem}>
            <Text style={styles.forecastDay}>{day.day}</Text>
            <Ionicons name={day.icon as any} size={24} color="#FFF" />
            <Text style={styles.forecastTemp}>{day.temp}°C</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DetailItem({ icon, value, label }: any) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={18} color="#8CC63F" />
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.detailValue}>{value}</Text>
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(13,19,32,0.88)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  location: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  condition: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  staleText: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 4,
    fontWeight: '600',
  },
  noData: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 8,
  },
  temp: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8CC63F',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  forecastContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastItem: {
    alignItems: 'center',
    flex: 1,
  },
  forecastDay: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  forecastTemp: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
});
