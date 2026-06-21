import { create } from 'zustand';
import {
  GuidedExpedition,
  ExpeditionBooking,
  fetchExpeditions,
  fetchExpeditionById,
  joinExpedition,
  fetchMyExpeditionBookings,
  fetchGuideExpeditions,
  createExpedition,
  addExpeditionPackage,
  addItineraryDay,
  publishExpedition,
  cancelExpeditionBooking,
} from '@/lib/expeditions';

interface ExpeditionFilters {
  difficulty?: string;
  destination?: string;
  fromDate?: string;
}

interface ExpeditionState {
  expeditions: GuidedExpedition[];
  activeExpedition: GuidedExpedition | null;
  myBookings: ExpeditionBooking[];
  myExpeditions: GuidedExpedition[];
  loading: boolean;
  error: string | null;
  filters: ExpeditionFilters;

  // Actions
  fetchExpeditions: () => Promise<void>;
  setFilters: (filters: ExpeditionFilters) => void;
  fetchExpeditionById: (id: string) => Promise<void>;
  joinExpedition: (
    expeditionId: string,
    packageId: string,
    seats?: number
  ) => Promise<{ success: boolean; waitlisted: boolean; error?: any }>;
  cancelBooking: (bookingId: string) => Promise<{ error: any }>;
  fetchMyBookings: (userId: string) => Promise<void>;
  fetchMyExpeditions: (guideId: string) => Promise<void>;
  createAndPublishExpedition: (data: {
    basics: {
      guide_id: string;
      title: string;
      description: string;
      destination: string;
      start_date: string;
      end_date: string;
      difficulty: string;
      max_seats: number;
      what_to_bring?: string[];
      meeting_point?: string;
      cancellation_policy?: string;
    };
    packages: Array<{
      name: string;
      price_per_person: number;
      inclusions: string[];
      exclusions?: string[];
    }>;
    itinerary: Array<{
      day_number: number;
      title: string;
      description?: string;
      activities?: string[];
    }>;
    publishNow?: boolean;
  }) => Promise<{ expeditionId: string | null; error: any }>;
  clearActive: () => void;
  clearError: () => void;
}

export const useExpeditionStore = create<ExpeditionState>((set, get) => ({
  expeditions: [],
  activeExpedition: null,
  myBookings: [],
  myExpeditions: [],
  loading: false,
  error: null,
  filters: {},

  fetchExpeditions: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await fetchExpeditions(get().filters);
      if (error) throw error;
      set({ expeditions: data || [], loading: false });
    } catch (error: any) {
      set({ error: error?.message || 'Failed to load expeditions', loading: false });
    }
  },

  setFilters: (filters) => {
    set({ filters });
    get().fetchExpeditions();
  },

  fetchExpeditionById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await fetchExpeditionById(id);
      if (error) throw error;
      set({ activeExpedition: data, loading: false });
    } catch (error: any) {
      set({ error: error?.message || 'Failed to load expedition', loading: false });
    }
  },

  joinExpedition: async (expeditionId, packageId, seats = 1) => {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { success: false, waitlisted: false, error: 'Not authenticated' };
    }

    const result = await joinExpedition(expeditionId, session.user.id, packageId, seats);

    if (!result.error) {
      await get().fetchExpeditionById(expeditionId);
    }

    return { success: !result.error, waitlisted: result.waitlisted, error: result.error };
  },

  cancelBooking: async (bookingId) => {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    const result = await cancelExpeditionBooking(bookingId, session?.user?.id ?? '');
    if (!result.error) {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await get().fetchMyBookings(session.user.id);
      }
    }
    return result;
  },

  fetchMyBookings: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await fetchMyExpeditionBookings(userId);
      if (error) throw error;
      set({ myBookings: data || [], loading: false });
    } catch (error: any) {
      set({ error: error?.message || 'Failed to load bookings', loading: false });
    }
  },

  fetchMyExpeditions: async (guideId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await fetchGuideExpeditions(guideId);
      if (error) throw error;
      set({ myExpeditions: data || [], loading: false });
    } catch (error: any) {
      set({ error: error?.message || 'Failed to load your expeditions', loading: false });
    }
  },

  createAndPublishExpedition: async ({ basics, packages, itinerary, publishNow = true }) => {
    set({ loading: true, error: null });
    try {
      // Step 1: Create expedition
      const { data: expedition, error: expError } = await createExpedition(basics as any);
      if (expError || !expedition) throw expError || new Error('Failed to create expedition');

      // Step 2: Add packages
      for (let i = 0; i < packages.length; i++) {
        const { error: pkgError } = await addExpeditionPackage({
          expedition_id: expedition.id,
          name: packages[i].name,
          price_per_person: packages[i].price_per_person,
          inclusions: packages[i].inclusions,
          exclusions: packages[i].exclusions || [],
          sort_order: i,
        });
        if (pkgError) throw pkgError;
      }

      // Step 3: Add itinerary days
      for (const day of itinerary) {
        const { error: dayError } = await addItineraryDay({
          expedition_id: expedition.id,
          day_number: day.day_number,
          title: day.title,
          description: day.description,
          activities: day.activities || [],
          meals_included: [],
        });
        if (dayError) throw dayError;
      }

      // Step 4: Publish if requested
      if (publishNow) {
        const { error: publishError } = await publishExpedition(expedition.id);
        if (publishError) throw publishError;
      }

      set({ loading: false });
      return { expeditionId: expedition.id, error: null };
    } catch (error: any) {
      set({ error: error?.message || 'Failed to create expedition', loading: false });
      return { expeditionId: null, error };
    }
  },

  clearActive: () => set({ activeExpedition: null }),
  clearError: () => set({ error: null }),
}));
