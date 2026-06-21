import { supabase } from './supabase';

/**
 * Social Following Logic
 */
export const socialHelpers = {
  async followUser(followerId: string, followingId: string) {
    const { error } = await supabase
      .from('user_follows')
      .insert({ follower_id: followerId, following_id: followingId });
    return { error };
  },

  async unfollowUser(followerId: string, followingId: string) {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    return { error };
  },

  async isFollowing(followerId: string, followingId: string) {
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();
    return !!data && !error;
  },

  async getFollowStats(userId: string) {
    const [followers, following] = await Promise.all([
      supabase.from('user_follows').select('id', { count: 'exact' }).eq('following_id', userId),
      supabase.from('user_follows').select('id', { count: 'exact' }).eq('follower_id', userId),
    ]);
    return {
      followers: followers.count || 0,
      following: following.count || 0,
    };
  }
};
