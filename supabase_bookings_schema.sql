-- Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  type TEXT CHECK (type IN ('homestay', 'guide', 'gear')) NOT NULL,
  resource_id UUID NOT NULL, -- homestay_id or guide_id
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  guests INTEGER DEFAULT 1,
  total_price INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can view their own bookings
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (user_id = auth.uid());

-- 2. Users can create bookings
CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Users can update their own bookings (e.g. cancel)
CREATE POLICY "Users can update own bookings" ON public.bookings
  FOR UPDATE USING (user_id = auth.uid());

-- 4. Resource owners (Hosts/Guides) need to view bookings for their resources
-- This requires a slightly complex policy or we rely on the owner fetching via a secure function.
-- For MVP, we'll maintain a simplified policy:
-- "Anyone can read bookings" (to check availability) but strict write access.
-- Actually, let's look up ownership. 
-- Since resource_id is generic, standard RLS is hard without joins.
-- We will use a separate query or Edge Function for hosts to manage bookings.

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_resource_id ON public.bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON public.bookings(start_date, end_date);
