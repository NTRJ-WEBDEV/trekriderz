import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useExpeditionStore } from '@/stores/expeditionStore';
import { getMyGuideProfile } from '@/lib/expeditions';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  published: { color: '#8CC63F', label: 'Published' },
  draft: { color: '#9CA3AF', label: 'Draft' },
  full: { color: '#F59E0B', label: 'Full' },
  completed: { color: '#3B82F6', label: 'Completed' },
  cancelled: { color: '#EF4444', label: 'Cancelled' },
};

export default function MyExpeditionsScreen() {
  const { user } = useAuthStore();
  const { myExpeditions, loading, fetchMyExpeditions } = useExpeditionStore();
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!user) return;
      const { data: profile } = await getMyGuideProfile(user.id);
      if (profile?.id) {
        await fetchMyExpeditions(profile.id);
      }
      setInitLoading(false);
    }
    init();
  }, [user]);

  if (initLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8CC63F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Expeditions</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/expeditions/create')}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8CC63F" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {myExpeditions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={72} color="rgba(255,255,255,0.08)" />
              <Text style={styles.emptyText}>No expeditions yet</Text>
              <Text style={styles.emptySub}>
                Create your first expedition and start sharing your adventures!
              </Text>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => router.push('/expeditions/create')}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                <Text style={styles.createBtnText}>Create Expedition</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardList}>
              {myExpeditions.map((exp) => {
                const cover =
                  exp.cover_photos?.[0] ||
                  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400';
                const startDate = new Date(exp.start_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                const statusCfg = STATUS_CONFIG[exp.status] || {
                  color: '#9CA3AF',
                  label: exp.status,
                };
                const seatsLeft = (exp.max_seats || 0) - (exp.booked_seats || 0);
                const fillPercent = exp.max_seats
                  ? Math.min(100, ((exp.booked_seats || 0) / exp.max_seats) * 100)
                  : 0;

                return (
                  <TouchableOpacity
                    key={exp.id}
                    style={styles.card}
                    onPress={() => router.push(`/expeditions/manage/${exp.id}` as any)}
                    activeOpacity={0.8}
                  >
                    {/* Thumbnail */}
                    <Image source={{ uri: cover }} style={styles.thumbnail} contentFit="cover" />

                    {/* Info */}
                    <View style={styles.cardBody}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {exp.title}
                        </Text>
                        <View
                          style={[
                            styles.statusChip,
                            {
                              backgroundColor: statusCfg.color + '20',
                              borderColor: statusCfg.color + '50',
                            },
                          ]}
                        >
                          <Text style={[styles.statusChipText, { color: statusCfg.color }]}>
                            {statusCfg.label.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={13} color="#8CC63F" />
                        <Text style={styles.metaText}>{exp.destination}</Text>
                      </View>

                      <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.metaText}>{startDate}</Text>
                      </View>

                      {/* Seats progress */}
                      <View style={styles.seatsRow}>
                        <View style={styles.progressBg}>
                          <View
                            style={[styles.progressFill, { width: `${fillPercent}%` }]}
                          />
                        </View>
                        <Text style={styles.seatsText}>
                          {exp.booked_seats || 0}/{exp.max_seats} booked
                        </Text>
                      </View>
                    </View>

                    {/* Manage Arrow */}
                    <View style={styles.arrowWrap}>
                      <Ionicons name="chevron-forward" size={18} color="#8CC63F" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8CC63F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  cardList: {
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  thumbnail: {
    width: 90,
    height: 110,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 5,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    lineHeight: 20,
  },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusChipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8CC63F',
    borderRadius: 2,
  },
  seatsText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  arrowWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  createBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
