-- Weather Reports Table for Crowd-sourced Weather
CREATE TABLE IF NOT EXISTS public.weather_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location TEXT NOT NULL,
  condition TEXT NOT NULL,
  temperature INTEGER,
  user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.weather_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view weather reports" ON public.weather_reports
  FOR SELECT USING (true);

CREATE POLICY "Logged in users can report weather" ON public.weather_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_weather_reports_location ON public.weather_reports(location);
