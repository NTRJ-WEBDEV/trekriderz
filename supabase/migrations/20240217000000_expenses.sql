-- Budget & Expenses Schema

create table trip_expenses (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references trips not null,
  user_id uuid references auth.users not null, -- Who paid
  description text not null,
  amount numeric not null,
  category text check (category in ('food', 'transport', 'accommodation', 'activities', 'shopping', 'other')),
  date timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- RLS Policies
alter table trip_expenses enable row level security;

-- Users can view expenses for trips they are part of (or public trips)
create policy "View expenses" on trip_expenses for select using (
  exists (
    select 1 from trips 
    where trips.id = trip_expenses.trip_id 
    and (trips.created_by = auth.uid() or trips.is_public = true)
  ) 
  or 
  exists (
    select 1 from trip_members 
    where trip_members.trip_id = trip_expenses.trip_id 
    and trip_members.user_id = auth.uid()
  )
);

-- Users can add expenses to trips they are part of
create policy "Add expenses" on trip_expenses for insert with check (
  exists (
    select 1 from trips 
    where trips.id = trip_expenses.trip_id 
    and trips.created_by = auth.uid()
  ) 
  or 
  exists (
    select 1 from trip_members 
    where trip_members.trip_id = trip_expenses.trip_id 
    and trip_members.user_id = auth.uid()
  )
);

-- Users can delete their own expenses
create policy "Delete own expenses" on trip_expenses for delete using (user_id = auth.uid());
