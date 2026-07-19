import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface TravelPartnerCardData {
  id: string; // trip id
  userName: string;
  userAvatar?: string | null;
  verified: boolean;
  destination: string;
  dateLabel: string;
  lookingFor: string; // trip_type — Bike/Backpacking/Trekking/Road Trip...
  genderPreference?: string | null;
  ageRange?: string | null; // no backing column today
}

interface Props {
  item: TravelPartnerCardData;
  onPress: () => void;
  onConnect: () => void;
}

export default function TravelPartnerCard({ item, onPress, onConnect }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.topRow}>
        {item.userAvatar ? (
          <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{item.userName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.userName}</Text>
            {item.verified && (
              <View style={styles.premiumBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#080C14" />
                <Text style={styles.premiumText}>Verified</Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={11} color={AppColors.primary} />
            <Text style={styles.metaText} numberOfLines={1}>{item.destination}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.dateLabel}>{item.dateLabel}</Text>

      <View style={styles.tagsRow}>
        <View style={styles.tag}><Text style={styles.tagText}>{item.lookingFor}</Text></View>
        {item.genderPreference && (
          <View style={styles.tag}><Text style={styles.tagText}>{item.genderPreference}</Text></View>
        )}
        <View style={styles.tag}><Text style={styles.tagText}>{item.ageRange || 'Any age'}</Text></View>
      </View>

      <TouchableOpacity style={styles.connectBtn} onPress={onConnect}>
        <Ionicons name="chatbubble-outline" size={14} color="#080C14" />
        <Text style={styles.connectText}>Connect</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.md,
    gap: 8,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: AppColors.primary },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: AppColors.primary, fontSize: 17, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: AppColors.text, fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: AppColors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  premiumText: { color: '#080C14', fontSize: 8.5, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { color: AppColors.subtext, fontSize: 11.5, flex: 1 },
  dateLabel: { color: AppColors.subtext, fontSize: 11.5, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: Radius.pill,
    paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  tagText: { color: AppColors.primary, fontSize: 10.5, fontWeight: '600', textTransform: 'capitalize' },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: AppColors.primary, borderRadius: Radius.pill, paddingVertical: 9, marginTop: 2,
  },
  connectText: { color: '#080C14', fontSize: 12.5, fontWeight: '800' },
});
