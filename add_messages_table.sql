-- Add Trip Messages Table
CREATE TABLE IF NOT EXISTS public.trip_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.trip_messages ENABLE ROW LEVEL SECURITY;

-- Allow read access to trip members
CREATE POLICY "Users can view trip messages if they are members"
    ON public.trip_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE trip_members.trip_id = trip_messages.trip_id
            AND trip_members.user_id = auth.uid()
        )
    );

-- Allow insert access to trip members
CREATE POLICY "Users can send messages if they are members"
    ON public.trip_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.trip_members
            WHERE trip_members.trip_id = trip_id
            AND trip_members.user_id = auth.uid()
        )
    );
