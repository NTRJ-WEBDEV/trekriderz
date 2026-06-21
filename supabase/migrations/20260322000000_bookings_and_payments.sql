-- WandR Booking and Payment System

-- 1. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  resource_type TEXT CHECK (resource_type IN ('homestay', 'guide', 'gear')) NOT NULL,
  resource_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  guests_count INTEGER DEFAULT 1,
  total_price INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Payment Orders Table (for tracking Razorpay/other payment attempts)
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  order_id TEXT UNIQUE NOT NULL, -- Razorpay order ID
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'paid', 'failed')),
  receipt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Booking History Table (for audit log)
CREATE TABLE IF NOT EXISTS public.booking_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  status_from TEXT,
  status_to TEXT,
  changed_by UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Bookings
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bookings" ON public.bookings
  FOR UPDATE USING (user_id = auth.uid());

-- Payment Orders
CREATE POLICY "Users can view own payment orders" ON public.payment_orders
  FOR SELECT USING (user_id = auth.uid());

-- Booking History
CREATE POLICY "Users can view own booking history" ON public.booking_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = booking_history.booking_id
      AND bookings.user_id = auth.uid()
    )
  );

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_resource_id ON public.bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON public.bookings(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payment_orders_booking_id ON public.payment_orders(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON public.payment_orders(order_id);

-- 7. Triggers for Booking History
CREATE OR REPLACE FUNCTION handle_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.booking_history (booking_id, status_from, status_to, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_status_change
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION handle_booking_status_change();

-- 8. Availability Check Function (Generic)
CREATE OR REPLACE FUNCTION check_resource_availability(
  p_resource_id UUID,
  p_resource_type TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_conflict_count
  FROM public.bookings
  WHERE resource_id = p_resource_id
    AND resource_type = p_resource_type
    AND status IN ('pending', 'confirmed') -- Block pending requests too if needed
    AND (
      (start_date <= p_end_date AND end_date >= p_start_date)
    );

  RETURN v_conflict_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
