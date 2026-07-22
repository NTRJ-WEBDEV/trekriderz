import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Props {
  entityType: 'guides' | 'homestays' | 'vehicles';
  entityId: string;
  openCount: number;
}

// Compact entry point into the Review Resolution screen, shown from
// host/status.tsx, guide/application-status.tsx, and rentals/edit.tsx.
// Same rejectedCard visual language those screens already use (rgba red
// panel) is deliberately NOT reused here — itemized "changes requested"
// is a different, less final situation than an outright rejection, so it
// gets its own tone (amber, not red) rather than looking identical to one.
export default function ReviewSummaryBanner({ entityType, entityId, openCount }: Props) {
  if (openCount === 0) return null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/partner/review?entityType=${entityType}&id=${entityId}` as any)}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        <Ionicons name="information-circle" size={22} color="#F59E0B" />
        <View style={styles.textCol}>
          <Text style={styles.title}>
            {openCount} {openCount === 1 ? 'change' : 'changes'} requested
          </Text>
          <Text style={styles.subtitle}>Tap to see what's needed and respond</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textCol: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
});
