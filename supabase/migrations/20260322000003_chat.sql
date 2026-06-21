-- Trip Messages Table for Group Chat
CREATE TABLE IF NOT EXISTS public.trip_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_trip_messages_trip_id ON public.trip_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_messages_created_at ON public.trip_messages(created_at);

-- RLS
ALTER TABLE public.trip_messages ENABLE ROW LEVEL SECURITY;

-- Trip members can view and send messages
CREATE POLICY "Trip members can view messages" ON public.trip_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trip_messages.trip_id
      AND trip_members.user_id = auth.uid()
      AND trip_members.status = 'accepted'
    )
  );

CREATE POLICY "Trip members can send messages" ON public.trip_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trip_messages.trip_id
      AND trip_members.user_id = auth.uid()
      AND trip_members.status = 'accepted'
    )
  );

-- Enable real-time for trip_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'trip_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add trip_messages to realtime publication: %', SQLERRM;
END $$;
