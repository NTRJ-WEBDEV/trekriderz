-- Communities
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  category TEXT DEFAULT 'general',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  member_count INT NOT NULL DEFAULT 0,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_members (
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  media TEXT[] DEFAULT '{}',
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Direct messages between users
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON public.direct_messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_messages ON public.community_messages (community_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_posts ON public.community_posts (community_id, created_at DESC);

-- RLS
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communities_public_read" ON public.communities FOR SELECT TO authenticated USING (true);
CREATE POLICY "communities_insert" ON public.communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "communities_update" ON public.communities FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "community_members_read" ON public.community_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_members_join" ON public.community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_members_leave" ON public.community_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "community_posts_read" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_posts_insert" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_messages_read" ON public.community_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_messages_insert" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dm_read" ON public.direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "dm_send" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "dm_read_update" ON public.direct_messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);
