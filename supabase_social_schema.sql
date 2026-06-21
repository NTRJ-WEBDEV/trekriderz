-- Social Features Schema

-- 1. Weather Reports (Crowdsourced)
create table weather_reports (
  id uuid default uuid_generate_v4() primary key,
  location text not null,
  condition text not null, -- 'Sunny', 'Rainy', 'Snow', 'Fog', etc.
  temperature numeric, -- Optional
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default now(),
  valid_until timestamp with time zone default (now() + interval '3 hours') -- Reports expire
);

-- 2. Shared Packing Lists (Community)
create table shared_lists (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references trips not null,
  user_id uuid references auth.users not null,
  title text not null,
  description text,
  tags text[], -- ['trek', 'summer', 'budget']
  items jsonb not null, -- The actual packing list content
  likes_count int default 0,
  is_public boolean default true,
  created_at timestamp with time zone default now()
);

-- 3. Social Interactions (Likes & Comments)
create table list_likes (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references shared_lists not null,
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default now(),
  unique(list_id, user_id)
);

create table list_comments (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references shared_lists not null,
  user_id uuid references auth.users not null,
  content text not null,
  created_at timestamp with time zone default now()
);

-- RLS Policies (Simplified for prototype)
alter table weather_reports enable row level security;
create policy "Public read weather" on weather_reports for select using (true);
create policy "Auth insert weather" on weather_reports for insert with check (auth.uid() = user_id);

alter table shared_lists enable row level security;
create policy "Public read lists" on shared_lists for select using (is_public = true);
create policy "Auth insert lists" on shared_lists for insert with check (auth.uid() = user_id);
create policy "Owner update lists" on shared_lists for update using (auth.uid() = user_id);

alter table list_likes enable row level security;
create policy "Public read likes" on list_likes for select using (true);
create policy "Auth insert likes" on list_likes for insert with check (auth.uid() = user_id);

alter table list_comments enable row level security;
create policy "Public read comments" on list_comments for select using (true);
create policy "Auth insert comments" on list_comments for insert with check (auth.uid() = user_id);
