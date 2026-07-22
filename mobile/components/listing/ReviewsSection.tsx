import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';
import ReviewSheet from '@/components/ReviewSheet';
import { fetchReviews, summarizeReviews, type Review, type ReviewTargetType } from '@/lib/services/ReviewService';

interface Props {
  targetType: ReviewTargetType;
  targetId: string;
  targetName: string;
  reviewerId?: string;
}

// UX_BLUEPRINT.md §4: "Reviews and response rate are shown together, not
// review-average alone." Response rate doesn't exist as real data (see
// TrustEngineService.ts's comment on that), so this shows the average +
// count + full breakdown instead of a bare star — reused across all four
// listing types, replacing each screen's own hardcoded "No reviews yet"
// or write-only button.
export default function ReviewsSection({ targetType, targetId, targetName, reviewerId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWrite, setShowWrite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setReviews(await fetchReviews(targetType, targetId));
    setLoading(false);
  }, [targetType, targetId]);

  useEffect(() => { load(); }, [load]);

  const summary = summarizeReviews(reviews);
  const alreadyReviewed = !!reviewerId && reviews.some((r) => r.reviewer_id === reviewerId);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        {reviewerId && !alreadyReviewed && (
          <TouchableOpacity style={styles.writeBtn} onPress={() => setShowWrite(true)}>
            <Ionicons name="star-outline" size={14} color="#FCD34D" />
            <Text style={styles.writeBtnText}>Write a Review</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={AppColors.primary} style={{ marginVertical: 16 }} />
      ) : reviews.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={28} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyText}>No reviews yet — be the first to share your experience.</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <Text style={styles.avgNumber}>{summary.average?.toFixed(1)}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name={s <= Math.round(summary.average || 0) ? 'star' : 'star-outline'} size={14} color="#FCD34D" />
                ))}
              </View>
              <Text style={styles.countText}>{summary.count} review{summary.count !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          <View style={styles.list}>
            {reviews.slice(0, 8).map((r) => (
              <View key={r.id} style={styles.reviewRow}>
                {r.reviewer?.avatar_url ? (
                  <Image source={{ uri: r.reviewer.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{(r.reviewer?.full_name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewerName} numberOfLines={1}>{r.reviewer?.full_name || 'TrekRiderz traveller'}</Text>
                    <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <View style={styles.starsRowSmall}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons key={s} name={s <= r.rating ? 'star' : 'star-outline'} size={11} color="#FCD34D" />
                    ))}
                  </View>
                  {r.comment && <Text style={styles.comment}>{r.comment}</Text>}
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <ReviewSheet
        visible={showWrite}
        targetId={targetId}
        targetType={targetType}
        targetName={targetName}
        reviewerId={reviewerId || ''}
        onClose={() => setShowWrite(false)}
        onSubmitted={() => { setShowWrite(false); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  writeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
  writeBtnText: { color: '#FCD34D', fontSize: 12.5, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avgNumber: { color: '#FFF', fontSize: 34, fontWeight: '800' },
  starsRow: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  countText: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  list: { gap: 16 },
  reviewRow: { flexDirection: 'row', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: AppColors.primary, fontSize: 14, fontWeight: '800' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  reviewerName: { color: '#FFF', fontSize: 13, fontWeight: '700', flex: 1 },
  reviewDate: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  starsRowSmall: { flexDirection: 'row', gap: 2, marginTop: 2, marginBottom: 4 },
  comment: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 19 },
});
