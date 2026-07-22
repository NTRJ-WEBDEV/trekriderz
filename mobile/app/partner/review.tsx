import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/ui/ScreenHeader';
import ChangeRequestCard from '../../components/partner/ChangeRequestCard';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import {
  fetchChangeRequests, markCaseReadyForReview,
  type ChangeRequest, type ApprovalEntity,
} from '../../lib/services/ReviewWorkspaceService';

const ENTITY_TABLE: Record<ApprovalEntity, string> = { guides: 'guides', homestays: 'properties', vehicles: 'rental_vehicles' };
const ENTITY_LABEL: Record<ApprovalEntity, string> = { guides: 'Guide Application', homestays: 'Homestay Listing', vehicles: 'Vehicle Listing' };

// The Partner Portal's Review Resolution screen — one parameterized
// screen for all three partner types rather than three near-identical
// ones, since the response mechanics (comment, edit field, upload
// replacement, mark ready) are identical, only the underlying table
// differs. Reached from host/status.tsx, guide/application-status.tsx,
// and rentals/edit.tsx via ReviewSummaryBanner.
export default function PartnerReviewScreen() {
  const { entityType, id } = useLocalSearchParams<{ entityType: ApprovalEntity; id: string }>();
  const user = useAuthStore((s) => s.user);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [entityName, setEntityName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!entityType || !id) return;
    const table = ENTITY_TABLE[entityType];
    const nameField = entityType === 'guides' ? 'full_name' : entityType === 'homestays' ? 'name' : 'make';
    const [{ data: entity }, items] = await Promise.all([
      supabase.from(table).select(`${nameField}`).eq('id', id).maybeSingle(),
      fetchChangeRequests(entityType, id),
    ]);
    setEntityName((entity as any)?.[nameField] || ENTITY_LABEL[entityType]);
    setRequests(items);
    setLoading(false);
    setRefreshing(false);
  }, [entityType, id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openCount = requests.filter((r) => !['resolved', 'verified'].includes(r.status)).length;
  const allReadyOrDone = requests.length > 0 && requests.every((r) => ['ready_for_review', 'resolved', 'verified'].includes(r.status));

  const handleMarkReady = async () => {
    if (!entityType || !id || !user?.id) return;
    setSubmitting(true);
    try {
      await markCaseReadyForReview(entityType, id, user.id);
      Alert.alert('Sent for Review', 'Your responses have been submitted for re-review.');
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not submit for review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Review Resolution" />
        <View style={styles.loadingBox}><ActivityIndicator color="#8CC63F" /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Review Resolution" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8CC63F" />}
      >
        <Text style={styles.entityName}>{entityName}</Text>
        <Text style={styles.subtitle}>
          {openCount > 0 ? `${openCount} item${openCount === 1 ? '' : 's'} need${openCount === 1 ? 's' : ''} your attention` : 'All caught up'}
        </Text>

        {requests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={32} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>No changes have been requested.</Text>
          </View>
        ) : (
          requests.map((r) => (
            <ChangeRequestCard
              key={r.id}
              request={r}
              entityType={entityType as ApprovalEntity}
              entityId={id as string}
              userId={user?.id || ''}
              onUpdated={load}
            />
          ))
        )}
      </ScrollView>

      {openCount > 0 && !allReadyOrDone && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.readyBtn} onPress={handleMarkReady} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#080C14" /> : <Text style={styles.readyBtnText}>Mark Ready For Review</Text>}
          </TouchableOpacity>
          <Text style={styles.footerHint}>Only submit once you've responded to every item above.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  entityName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4, marginBottom: 16 },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: '#080C14' },
  readyBtn: { backgroundColor: '#8CC63F', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  readyBtnText: { color: '#080C14', fontSize: 15, fontWeight: '800' },
  footerHint: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
