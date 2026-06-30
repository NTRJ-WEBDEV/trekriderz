-- Add coordinate columns to guides table so guide locations can be pinned on the map
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);
