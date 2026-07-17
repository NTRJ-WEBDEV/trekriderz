import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// App-owned "who was last signed in" hint, separate from the Supabase SDK's
// own session storage. supabase.auth.getSession() blocks on a network token
// refresh whenever the cached access token has actually expired — the
// common case after the app has been closed longer than its ~1h JWT
// lifetime — which otherwise stalls the root layout's splash screen for
// however long that request takes. Reading this hint lets init() render the
// app immediately on a warm start; the real getSession() call below still
// runs and corrects course (including signing out) if the refresh fails.
const LAST_USER_KEY = 'trekriderz_last_user';

async function cacheLastUser(user: User | null) {
  try {
    if (user) await AsyncStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(LAST_USER_KEY);
  } catch (e) {
    // Non-critical — worst case, next cold start falls back to the blocking path.
  }
}

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
  logout: () => {
    cacheLastUser(null);
    set({ user: null, session: null });
  },

  // Initialize auth state by checking for existing session
  init: async () => {
    try {
      const cached = await AsyncStorage.getItem(LAST_USER_KEY);
      if (cached) {
        set({ user: JSON.parse(cached), loading: false });
      }
    } catch (e) {
      // Ignore — falls through to the normal (blocking) path below.
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        set({ session, user: session.user, loading: false });
        cacheLastUser(session.user);
        trackDailyActivity(session.user.id);
      } else {
        set({ session: null, user: null, loading: false });
        cacheLastUser(null);
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });
        cacheLastUser(session?.user ?? null);
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

