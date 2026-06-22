import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { fetchWeatherByCoords } from '@/lib/weather';
import * as Location from 'expo-location';

interface WeatherWidgetProps {
  location: string;
}

const MOCK_WEATHER = {
  temp: 22,
  condition: 'Cloudy',
  icon: 'cloud',
  humidity: 60,
  wind: 10,
  forecast: [
    { day: 'Tue', temp: 24, icon: 'sunny' },
    { day: 'Wed', temp: 21, icon: 'rainy' },
    { day: 'Thu', temp: 23, icon: 'partly-sunny' },
  ]
};

export default function WeatherWidget({ location }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchWeather();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('weather_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'weather_reports', filter: `location=eq.${location}` },
        (payload) => {
          setWeather((prev: any) => ({
            ...prev,
            condition: payload.new.condition,
            temp: payload.new.temperature || prev?.temp,
            reporter: 'Just now',
            isUserReport: true,
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [location]);

  const fetchWeather = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('weather_reports')
        .select('*')
        .eq('location', location)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setWeather({
          temp: data.temperature || 18,
          condition: data.condition,
          icon: getIconForCondition(data.condition),
          humidity: 65,
          wind: 12,
          forecast: MOCK_WEATHER.forecast,
          isUserReport: true,
        });
      } else {
        await fetchLiveWeather();
      }
    } catch (e) {
      await fetchLiveWeather();
    }
    setLoading(false);
  };

  const fetchLiveWeather = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setWeather({ ...MOCK_WEATHER, location }); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const live = await fetchWeatherByCoords(loc.coords.latitude, loc.coords.longitude);
      if (live) {
        setWeather({
          temp: live.currentTemp,
          condition: live.condition,
          icon: live.icon,
          humidity: live.humidity,
          wind: live.wind,
          forecast: live.forecast,
          isUserReport: false,
        });
      } else {
        setWeather({ ...MOCK_WEATHER, location });
      }
    } catch {
      setWeather({ ...MOCK_WEATHER, location });
    }
  };

  const submitReport = async (condition: string) => {
    if (!user) return;
    try {
      await supabase.from('weather_reports').insert({
        location,
        condition,
        temperature: 20,
        user_id: user.id,
      });
      setReportModalVisible(false);
      alert('Thanks for the update!');
    } catch (e) {
      console.error(e);
    }
  };

  const getIconForCondition = (cond: string): string => {
    const c = cond.toLowerCase();
    if (c.includes('sun')) return 'sunny';
    if (c.includes('rain')) return 'rainy';
    if (c.includes('cloud')) return 'cloud';
    if (c.includes('snow')) return 'snow';
    return 'partly-sunny';
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#8CC63F" />
    </View>
  );

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.locationTitle}>{location}</Text>
          <View style={styles.sourceTag}>
            <Text style={styles.condition}>{weather?.condition}</Text>
            {weather?.isUserReport && (
              <View style={styles.travelerBadge}>
                <Ionicons name="person" size={10} color="#8CC63F" />
                <Text style={styles.userReportBadge}>by traveler</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => setReportModalVisible(true)} style={styles.reportBtn}>
          <Ionicons name="add-circle-outline" size={30} color="#8CC63F" />
        </TouchableOpacity>
      </View>

      {/* Main Weather Display */}
      <View style={styles.mainWeather}>
        <Ionicons name={(weather?.icon || 'cloud-outline') as any} size={52} color="#FFF" />
        <Text style={styles.temp}>{weather?.temp}°</Text>
        <Text style={styles.tempUnit}>C</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="water-outline" size={16} color="#B8BCC8" />
          <Text style={styles.statLabel}>Humidity</Text>
          <Text style={styles.statVal}>{weather?.humidity}%</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Ionicons name="leaf-outline" size={16} color="#B8BCC8" />
          <Text style={styles.statLabel}>Wind</Text>
          <Text style={styles.statVal}>{weather?.wind} km/h</Text>
        </View>
      </View>

      {/* Forecast Row */}
      {Array.isArray(weather?.forecast) && weather.forecast.length > 0 && (
        <View style={styles.forecastRow}>
          {weather.forecast.map((day: any, idx: number) => (
            <View key={idx} style={styles.forecastItem}>
              <Text style={styles.forecastDay}>{day.day}</Text>
              <Ionicons name={(day.icon || 'cloud-outline') as any} size={20} color="#D1D5DB" />
              <Text style={styles.forecastTemp}>{day.temp}°</Text>
            </View>
          ))}
        </View>
      )}

      {/* Refresh button */}
      <TouchableOpacity style={styles.refreshRow} onPress={fetchWeather}>
        <Ionicons name="refresh-outline" size={14} color="#6B7280" />
        <Text style={styles.refreshText}>Tap to refresh</Text>
      </TouchableOpacity>

      {/* Report Weather Modal */}
      <Modal
        visible={reportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModal}>
            <Text style={styles.reportTitle}>What's the weather in {location}?</Text>
            <Text style={styles.reportSubtitle}>Help fellow trekkers with a live update</Text>

            <View style={styles.reportButtons}>
              {[
                { label: 'Sunny', emoji: '☀️', value: 'Sunny' },
                { label: 'Cloudy', emoji: '☁️', value: 'Cloudy' },
                { label: 'Rainy', emoji: '🌧️', value: 'Rainy' },
                { label: 'Snow', emoji: '❄️', value: 'Snow' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.reportBtn2}
                  onPress={() => submitReport(item.value)}
                >
                  <Text style={styles.reportEmoji}>{item.emoji}</Text>
                  <Text style={styles.reportBtnText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setReportModalVisible(false)}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    gap: 4,
    flex: 1,
  },
  locationTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  condition: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  travelerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(140,198,63,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  userReportBadge: {
    color: '#8CC63F',
    fontSize: 11,
    fontWeight: '500',
  },
  reportBtn: {
    padding: 2,
  },
  mainWeather: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  temp: {
    color: '#FFF',
    fontSize: 56,
    fontWeight: '200',
    lineHeight: 60,
  },
  tempUnit: {
    color: '#9CA3AF',
    fontSize: 22,
    fontWeight: '300',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  statVal: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  forecastItem: {
    alignItems: 'center',
    gap: 6,
  },
  forecastDay: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  forecastTemp: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  refreshText: {
    color: '#6B7280',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reportModal: {
    backgroundColor: '#0F1520',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 16,
  },
  reportTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  reportSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -8,
  },
  reportButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  reportBtn2: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    minWidth: '42%',
  },
  reportEmoji: {
    fontSize: 28,
  },
  reportBtnText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
