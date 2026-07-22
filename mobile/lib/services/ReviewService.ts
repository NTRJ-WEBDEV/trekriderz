import { supabase } from '../supabase';

// Traveller Discovery Experience — reviews were being collected
// (ReviewSheet.tsx inserts into `reviews`) but never read back anywhere:
// homestay/[id].tsx hardcoded "No reviews yet", guide/[id].tsx only
// offered a write button, and expeditions/rentals had no review surface
// at all. This is the one read (and summarize) path, reused by
// ReviewsSection.tsx across all four listing types.

export type ReviewTargetType = 'guide' | 'homestay' | 'expedition' | 'vehicle';

export interface Review {
  id: string;
  target_type: ReviewTargetType;
  target_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: { full_name: string | null; avatar_url: string | null } | null;
}

export interface ReviewSummary {
  average: number | null;
  count: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

// Single query — no separate "summary" round trip. The average/breakdown
// are derived client-side from the same rows the list already needed.
export async function fetchReviews(targetType: ReviewTargetType, targetId: string, limit = 30): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:users!reviewer_id(full_name, avatar_url)')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('ReviewService.fetchReviews failed:', error.message); return []; }
  return (data as Review[]) || [];
}

export function summarizeReviews(reviews: Review[]): ReviewSummary {
  const breakdown: ReviewSummary['breakdown'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (reviews.length === 0) return { average: null, count: 0, breakdown };
  let sum = 0;
  for (const r of reviews) {
    sum += r.rating;
    breakdown[r.rating as 1 | 2 | 3 | 4 | 5] = (breakdown[r.rating as 1 | 2 | 3 | 4 | 5] || 0) + 1;
  }
  return { average: sum / reviews.length, count: reviews.length, breakdown };
}
