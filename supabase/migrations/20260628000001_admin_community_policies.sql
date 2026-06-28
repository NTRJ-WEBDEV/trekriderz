-- Admin policies for community management
-- Authenticated admin users can create/update/delete any community regardless of created_by
CREATE POLICY "communities_admin_manage" ON public.communities
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- Web admin dashboard uses anon key + password gate — allow anon to manage communities
-- (consistent with existing anon policies on trips and youtube_videos tables)
CREATE POLICY "communities_anon_manage" ON public.communities
  FOR ALL TO anon USING (true) WITH CHECK (true);
