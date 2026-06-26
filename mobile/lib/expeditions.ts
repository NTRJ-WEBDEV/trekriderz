import { supabase } from '@/lib/supabase';

// =====================================================
// TypeScript Interfaces
// =====================================================

export interface GuidedExpedition {
  id: string;
  guide_id: string;
  title: string;
  description: string;
  destination: string;
  lat?: number;
  lng?: number;
  cover_photos: string[];
  start_date: string;
  end_date: string;
  difficulty: 'easy' | 'moderate' | 'challenging' | 'expert';
  max_seats: number;
  booked_seats: number;
  status: 'draft' | 'published' | 'full' | 'ongoing' | 'completed' | 'cancelled';
  route_geojson?: any;
  what_to_bring: string[];
  cancellation_policy?: string;
  meeting_point?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  guide?: {
    id: string;
    name: string;
    photo_url?: string;
    rating?: number;
    experience_years?: number;
    location?: string;
    bio?: string;
    is_premium?: boolean;
  };
  min_price?: number;
  packages?: ExpeditionPackage[];
  itinerary_days?: ExpeditionItineraryDay[];
  waitlist_count?: number;
}

export interface ExpeditionPackage {
  id: string;
  expedition_id: string;
  name: string;
  price_per_person: number;
  inclusions: string[];
  exclusions: string[];
  sort_order: number;
  created_at: string;
}

export interface ExpeditionItineraryDay {
  id: string;
  expedition_id: string;
  day_number: number;
  title: string;
  description?: string;
  activities: string[];
  accommodation?: string;
  meals_included: string[];
  distance_km?: number;
  elevation_gain_m?: number;
  created_at: string;
}

export interface ExpeditionBooking {
  id: string;
  expedition_id: string;
  user_id: string;
  package_id?: string;
  seats: number;
  total_price?: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  special_requests?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  expedition?: Partial<GuidedExpedition>;
  package?: Partial<ExpeditionPackage>;
}

export interface ExpeditionWaitlistEntry {
  id: string;
  expedition_id: string;
  user_id: string;
  created_at: string;
}

// =====================================================
// Query Functions
// =====================================================

/**
 * Fetch published expeditions with guide info and minimum package price.
 */
export async function fetchExpeditions(filters?: {
  difficulty?: string;
  destination?: string;
  fromDate?: string;
}): Promise<{ data: GuidedExpedition[] | null; error: any }> {
  try {
    let query = supabase
      .from('guided_expeditions')
      .select(`
        *,
        guide:guides(id, name, photo_url, rating, experience_years, is_premium),
        packages:expedition_packages(id, price_per_person, sort_order)
      `)
      .in('status', ['published', 'full'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (filters?.difficulty) {
      query = query.eq('difficulty', filters.difficulty);
    }
    if (filters?.destination) {
      query = query.ilike('destination', `%${filters.destination}%`);
    }
    if (filters?.fromDate) {
      query = query.gte('start_date', filters.fromDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Attach min_price from packages
    const enriched = (data || []).map((exp: any) => ({
      ...exp,
      min_price: exp.packages?.length
        ? Math.min(...exp.packages.map((p: any) => p.price_per_person))
        : undefined,
    }));

    return { data: enriched, error: null };
  } catch (error) {
    console.error('fetchExpeditions error:', error);
    return { data: null, error };
  }
}

/**
 * Fetch a single expedition with full details.
 */
export async function fetchExpeditionById(id: string): Promise<{
  data: GuidedExpedition | null;
  error: any;
}> {
  try {
    const [expeditionRes, waitlistRes] = await Promise.all([
      supabase
        .from('guided_expeditions')
        .select(`
          *,
          guide:guides(id, name, photo_url, rating, experience_years, bio, is_premium),
          packages:expedition_packages(*),
          itinerary_days:expedition_itinerary_days(*)
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('expedition_waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('expedition_id', id),
    ]);

    if (expeditionRes.error) throw expeditionRes.error;

    const data: GuidedExpedition = {
      ...expeditionRes.data,
      itinerary_days: (expeditionRes.data.itinerary_days || []).sort(
        (a: any, b: any) => a.day_number - b.day_number
      ),
      packages: (expeditionRes.data.packages || []).sort(
        (a: any, b: any) => a.sort_order - b.sort_order
      ),
      waitlist_count: waitlistRes.count ?? 0,
      min_price: expeditionRes.data.packages?.length
        ? Math.min(...expeditionRes.data.packages.map((p: any) => p.price_per_person))
        : undefined,
    };

    return { data, error: null };
  } catch (error) {
    console.error('fetchExpeditionById error:', error);
    return { data: null, error };
  }
}

/**
 * Join an expedition. Auto-waitlists if no seats available.
 */
export async function joinExpedition(
  expeditionId: string,
  userId: string,
  packageId?: string,
  seats: number = 1,
  specialRequests?: string
): Promise<{ data: ExpeditionBooking | null; waitlisted: boolean; error: any }> {
  try {
    // Fetch current expedition state
    const { data: expedition, error: fetchError } = await supabase
      .from('guided_expeditions')
      .select('max_seats, booked_seats, status')
      .eq('id', expeditionId)
      .single();

    if (fetchError) throw fetchError;

    const seatsAvailable = expedition.max_seats - expedition.booked_seats;
    const isFull = seatsAvailable < seats || expedition.status === 'full';

    if (isFull) {
      // Add to waitlist
      const { error: waitlistError } = await supabase
        .from('expedition_waitlist')
        .insert({ expedition_id: expeditionId, user_id: userId });

      if (waitlistError) throw waitlistError;

      return { data: null, waitlisted: true, error: null };
    }

    // Calculate total price if package provided
    let totalPrice: number | undefined;
    if (packageId) {
      const { data: pkg } = await supabase
        .from('expedition_packages')
        .select('price_per_person')
        .eq('id', packageId)
        .single();
      if (pkg) {
        totalPrice = pkg.price_per_person * seats;
      }
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('expedition_bookings')
      .insert({
        expedition_id: expeditionId,
        user_id: userId,
        package_id: packageId || null,
        seats,
        total_price: totalPrice,
        status: 'pending',
        special_requests: specialRequests || null,
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Increment booked_seats
    await supabase.rpc('increment_expedition_seats', {
      p_expedition_id: expeditionId,
      p_seats: seats,
    });

    return { data: booking, waitlisted: false, error: null };
  } catch (error) {
    console.error('joinExpedition error:', error);
    return { data: null, waitlisted: false, error };
  }
}

/**
 * Cancel an expedition booking.
 */
export async function cancelExpeditionBooking(
  bookingId: string,
  userId: string
): Promise<{ error: any }> {
  try {
    // Fetch booking to get seats and expedition id
    const { data: booking, error: fetchError } = await supabase
      .from('expedition_bookings')
      .select('expedition_id, seats, status')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;
    if (booking.status === 'cancelled') {
      throw new Error('Booking is already cancelled.');
    }

    // Mark as cancelled
    const { error: updateError } = await supabase
      .from('expedition_bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Decrement booked_seats
    await supabase.rpc('decrement_expedition_seats', {
      p_expedition_id: booking.expedition_id,
      p_seats: booking.seats,
    });

    return { error: null };
  } catch (error) {
    console.error('cancelExpeditionBooking error:', error);
    return { error };
  }
}

/**
 * Fetch all bookings for a user.
 */
export async function fetchUserExpeditionBookings(userId: string): Promise<{
  data: ExpeditionBooking[] | null;
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('expedition_bookings')
      .select(`
        *,
        expedition:guided_expeditions(id, title, destination, start_date, end_date, cover_photos, difficulty, status),
        package:expedition_packages(id, name, price_per_person)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: data as ExpeditionBooking[], error: null };
  } catch (error) {
    console.error('fetchUserExpeditionBookings error:', error);
    return { data: null, error };
  }
}

/**
 * Fetch all expeditions created by a guide.
 */
export async function fetchGuideExpeditions(guideId: string): Promise<{
  data: GuidedExpedition[] | null;
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('guided_expeditions')
      .select(`
        *,
        packages:expedition_packages(id, price_per_person, sort_order)
      `)
      .eq('guide_id', guideId)
      .order('start_date', { ascending: true });

    if (error) throw error;

    const enriched = (data || []).map((exp: any) => ({
      ...exp,
      min_price: exp.packages?.length
        ? Math.min(...exp.packages.map((p: any) => p.price_per_person))
        : undefined,
    }));

    return { data: enriched, error: null };
  } catch (error) {
    console.error('fetchGuideExpeditions error:', error);
    return { data: null, error };
  }
}

/** Alias kept for store compatibility */
export const fetchMyExpeditionBookings = fetchUserExpeditionBookings;

/** Check if a guide profile is premium */
export async function checkGuideIsPremium(guideId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('guides')
      .select('is_premium')
      .eq('id', guideId)
      .single();
    return data?.is_premium ?? false;
  } catch {
    return false;
  }
}

/** Get guide profile for the currently authenticated user */
export async function getMyGuideProfile(userId: string): Promise<{
  data: any | null;
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('guides')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/** Create a new expedition draft */
export async function createExpedition(
  payload: Partial<GuidedExpedition>
): Promise<{ data: GuidedExpedition | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('guided_expeditions')
      .insert({ ...payload, status: 'draft' })
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Add a pricing package to an expedition */
export async function addExpeditionPackage(
  pkg: Omit<ExpeditionPackage, 'id' | 'created_at'>
): Promise<{ data: ExpeditionPackage | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('expedition_packages')
      .insert(pkg)
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Add an itinerary day to an expedition */
export async function addItineraryDay(
  day: Omit<ExpeditionItineraryDay, 'id' | 'created_at'>
): Promise<{ data: ExpeditionItineraryDay | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('expedition_itinerary_days')
      .insert(day)
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Publish an expedition (change status from draft to published) */
export async function publishExpedition(expeditionId: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('guided_expeditions')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', expeditionId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/** Fetch all bookings for a specific expedition (guide use) */
export async function fetchExpeditionBookings(expeditionId: string): Promise<{
  data: ExpeditionBooking[] | null;
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('expedition_bookings')
      .select(`*, user:users(id, full_name, avatar_url)`)
      .eq('expedition_id', expeditionId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data as ExpeditionBooking[], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Fetch waitlist entries for an expedition */
export async function fetchExpeditionWaitlist(expeditionId: string): Promise<{
  data: ExpeditionWaitlistEntry[] | null;
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('expedition_waitlist')
      .select(`*, user:users(id, full_name, avatar_url)`)
      .eq('expedition_id', expeditionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return { data: data as ExpeditionWaitlistEntry[], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Confirm a pending expedition booking */
export async function confirmExpeditionBooking(bookingId: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('expedition_bookings')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/**
 * Check if a user has already booked or waitlisted a given expedition.
 */
export async function checkUserExpeditionStatus(
  expeditionId: string,
  userId: string
): Promise<{
  booked: boolean;
  waitlisted: boolean;
  booking: ExpeditionBooking | null;
  error: any;
}> {
  try {
    const [bookingRes, waitlistRes] = await Promise.all([
      supabase
        .from('expedition_bookings')
        .select('*')
        .eq('expedition_id', expeditionId)
        .eq('user_id', userId)
        .neq('status', 'cancelled')
        .maybeSingle(),
      supabase
        .from('expedition_waitlist')
        .select('id')
        .eq('expedition_id', expeditionId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    return {
      booked: !!bookingRes.data,
      waitlisted: !!waitlistRes.data,
      booking: bookingRes.data as ExpeditionBooking | null,
      error: bookingRes.error || waitlistRes.error || null,
    };
  } catch (error) {
    console.error('checkUserExpeditionStatus error:', error);
    return { booked: false, waitlisted: false, booking: null, error };
  }
}
