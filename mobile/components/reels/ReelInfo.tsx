import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Props {
  userId?: string;
  userName: string;
  caption?: string;
  location?: string;
  activityType?: string | null;
}

// Bottom-left overlay: creator + caption + optional location/activity tag,
// plus the Music and view-count placeholders the brief asks for — both
// UI-only, since neither has a backing column (Reels architecture audit,
// Section 4 & "Adventure Metadata").
export default function ReelInfo({ userId, userName, caption, location, activityType }: Props) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={() => userId && router.push(`/user/${userId}` as any)}>
        <Text style={styles.userName}>@{userName}</Text>
      </TouchableOpacity>

      {caption ? <Text style={styles.caption} numberOfLines={3}>{caption}</Text> : null}

      <View style={styles.metaRow}>
        {activityType && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{activityType}</Text>
          </View>
        )}
        {location && (
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color="#FFF" />
            <Text style={styles.metaText} numberOfLines={1}>{location}</Text>
          </View>
        )}
      </View>

      {/* Music placeholder — no audio-track system exists yet */}
      <View style={styles.metaItem}>
        <Ionicons name="musical-notes-outline" size={13} color="rgba(255,255,255,0.6)" />
        <Text style={styles.placeholderText}>Original audio</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingRight: 70 },
  userName: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  caption: { color: '#FFF', fontSize: 13.5, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  tag: {
    backgroundColor: 'rgba(140,198,63,0.85)', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  tagText: { color: '#080C14', fontSize: 10.5, fontWeight: '800', textTransform: 'capitalize' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#FFF', fontSize: 12, flexShrink: 1 },
  placeholderText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
