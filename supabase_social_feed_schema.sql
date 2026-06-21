-- Social Feed Schema (posts, likes, comments)
-- Run this in Supabase SQL Editor

-- 1. Posts table
create table if not exists posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  content text,
  media text[], -- Array of image/video URLs
  location text,
  trip_id uuid references trips(id), -- Optional: link to a trip
  visibility text default 'public' check (visibility in ('public', 'friends', 'private')),
  likes_count int default 0,
  comments_count int default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Post Likes
create table if not exists post_likes (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default now(),
  unique (post_id, user_id)
);

-- 3. Post Comments
create table if not exists post_comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  content text not null,
  created_at timestamp with time zone default now()
);

-- 4. Auto-update likes_count on like/unlike
create or replace function update_likes_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update posts set likes_count = likes_count - 1 where id = OLD.post_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists on_like_change on post_likes;
create trigger on_like_change
  after insert or delete on post_likes
  for each row execute procedure update_likes_count();

-- 5. Auto-update comments_count
create or replace function update_comments_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update posts set comments_count = comments_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update posts set comments_count = comments_count - 1 where id = OLD.post_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists on_comment_change on post_comments;
create trigger on_comment_change
  after insert or delete on post_comments
  for each row execute procedure update_comments_count();

-- 6. RLS Policies

-- Posts
alter table posts enable row level security;
create policy "Anyone can view public posts" on posts for select using (visibility = 'public' or user_id = auth.uid());
create policy "Users can create posts" on posts for insert with check (user_id = auth.uid());
create policy "Users can update own posts" on posts for update using (user_id = auth.uid());
create policy "Users can delete own posts" on posts for delete using (user_id = auth.uid());

-- Likes
alter table post_likes enable row level security;
create policy "Anyone can view likes" on post_likes for select using (true);
create policy "Users can like posts" on post_likes for insert with check (user_id = auth.uid());
create policy "Users can unlike posts" on post_likes for delete using (user_id = auth.uid());

-- Comments
alter table post_comments enable row level security;
create policy "Anyone can view comments" on post_comments for select using (true);
create policy "Users can add comments" on post_comments for insert with check (user_id = auth.uid());
create policy "Users can delete own comments" on post_comments for delete using (user_id = auth.uid());
