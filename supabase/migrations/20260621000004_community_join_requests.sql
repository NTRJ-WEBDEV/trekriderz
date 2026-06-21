-- Add status to community_members for request-based joining
ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- Existing members (auto-joined creators) are already approved — set them
UPDATE public.community_members SET status = 'approved' WHERE status = 'pending';

-- Index for fast pending request lookups by community
CREATE INDEX IF NOT EXISTS idx_community_members_status
  ON public.community_members (community_id, status);

-- Helper RPC to safely increment member_count
CREATE OR REPLACE FUNCTION increment_community_members(community_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.communities
  SET member_count = member_count + 1
  WHERE id = community_id;
END;
$$;
