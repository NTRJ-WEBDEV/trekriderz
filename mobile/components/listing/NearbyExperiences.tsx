import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppColors, Spacing } from '@/constants/theme';
import ListingCard from '@/components/adventure/ListingCard';
import { fetchNearbyExperiences, routeForNearbyItem, type NearbyType } from '@/lib/services/NearbyService';

interface Props {
  lat: number | null | undefined;
  lng: number | null | undefined;
  excludeType: NearbyType;
  excludeId: string;
}

// Traveller Discovery Experience — "nearby experiences" reused across all
// four listing detail screens. Silently renders nothing if the listing
// has no coordinates or nothing else is nearby — an empty "Nearby"
// section would just be clutter, not a useful empty state (those are for
// screens the user explicitly searched/filtered on, not an incidental
// section at the bottom of a detail page).
export default function NearbyExperiences({ lat, lng, excludeType, excludeId }: Props) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchNearbyExperiences>>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) { setLoaded(true); return; }
    fetchNearbyExperiences({ lat: Number(lat), lng: Number(lng), excludeType, excludeId })
      .then(setItems)
      .finally(() => setLoaded(true));
  }, [lat, lng, excludeType, excludeId]);

  if (!loaded || items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Nearby Experiences</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => (
          <ListingCard key={`${item.type}-${item.id}`} item={item} onPress={() => router.push(routeForNearbyItem(item) as any)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28, marginHorizontal: -20 },
  title: { color: AppColors.text, fontSize: 17, fontWeight: '700', marginBottom: 14, marginHorizontal: 20 },
  row: { paddingHorizontal: 20, gap: Spacing.md },
});
