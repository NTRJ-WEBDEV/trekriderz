import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// Fires at most once per user per day (upsert is a no-op on repeat opens).
// Powers the daily-activity leaderboard used to pick giveaway winners.
async function trackDailyActivity(userId: string) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await supabase
      .from('user_daily_activity')
      .upsert({ user_id: userId, activity_date: today }, { onConflict: 'user_id,activity_date', ignoreDuplicates: true });
  } catch (e) {
    // Fail silently — activity tracking should never block app usage.
  }
  logger.logEvent('session_start', undefined, userId);
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, session: null }),
  
  // Initialize auth state by checking for existing session
  init: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        set({ session, user: session.user, loading: false });
        trackDailyActivity(session.user.id);
      } else {
        set({ session: null, user: null, loading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });
        if (_event === 'SIGNED_IN' && session) {
          trackDailyActivity(session.user.id);
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ loading: false });
    }
  },
}));

