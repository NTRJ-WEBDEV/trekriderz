-- "Anyone can view follows" (qual: true) sat alongside the more careful
-- follows_read policy (accepted-only, or a party to the row). RLS OR-combines
-- permissive policies, so the unconditional one made pending follow requests
-- visible to every authenticated user, not just the follower/followee —
-- defeating the point of a request-based follow model. Dropping it lets
-- follows_read's actual visibility rule take effect.
DROP POLICY IF EXISTS "Anyone can view follows" ON public.user_follows;
