-- Track read receipts per member per trip
ALTER TABLE public.trip_members
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_read_message_id UUID;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(target_trip_id UUID, target_user_id UUID, last_msg_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.trip_members
  SET 
    last_read_at = NOW(),
    last_read_message_id = last_msg_id
  WHERE trip_id = target_trip_id AND user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
