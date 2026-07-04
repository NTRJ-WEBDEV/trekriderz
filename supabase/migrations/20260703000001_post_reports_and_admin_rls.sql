-- Post reports table
CREATE TABLE IF NOT EXISTS public.post_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason      TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'actioned')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, reporter_id)
);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reports auth insert" ON public.post_reports;
DROP POLICY IF EXISTS "Reports admin read" ON public.post_reports;
DROP POLICY IF EXISTS "Reports admin update" ON public.post_reports;

-- Any authenticated user can file a report
CREATE POLICY "Reports auth insert" ON public.post_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Admins can read and act on all reports
CREATE POLICY "Reports admin read" ON public.post_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Reports admin update" ON public.post_reports
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Admin bypass on rental_vehicles so pending listings appear in admin dashboard
DROP POLICY IF EXISTS "Admin can read all rental_vehicles" ON public.rental_vehicles;
CREATE POLICY "Admin can read all rental_vehicles" ON public.rental_vehicles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id
    OR (status = 'approved' AND is_available = true)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
