-- ═══════════════════════════════════════════════════════════════════════════
--  NutriCoach — Supabase Schema
--  Run this entire file in the Supabase SQL Editor:
--  https://supabase.com/dashboard/project/bftggzsbovbjulbzyldj/sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles
--    One row per user. id = auth.users.id (UUID, not a serial).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                     uuid primary key references auth.users on delete cascade,
  full_name              text,
  age                    integer,
  sex                    text,
  height_cm              real,
  weight_kg              real,
  target_weight_kg       real,
  goal                   text,
  diet_type              text,
  training_level         text,
  training_location      text,
  training_days_per_week integer,
  created_at             timestamptz not null default now()
);

comment on table public.profiles is
  'User profile data — one row per auth user, id mirrors auth.users.id.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. food_preferences
--    Liked/disliked foods, allergies, and intolerances per user.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.food_preferences (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users on delete cascade,
  liked_foods    jsonb not null default '[]',
  disliked_foods jsonb not null default '[]',
  allergies      jsonb not null default '[]',
  intolerances   jsonb not null default '[]',
  created_at     timestamptz not null default now()
);

comment on column public.food_preferences.liked_foods    is 'Array of liked food strings, e.g. ["chicken", "broccoli"]';
comment on column public.food_preferences.disliked_foods is 'Array of disliked food strings';
comment on column public.food_preferences.allergies      is 'Array of allergen strings, e.g. ["nuts", "dairy"]';
comment on column public.food_preferences.intolerances   is 'Array of intolerance strings, e.g. ["gluten", "lactose"]';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. meal_plans
--    One row per meal (per user / week / day / meal_type).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.meal_plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  week_start         date not null,
  day_name           text not null,      -- e.g. 'monday', 'tuesday'
  meal_type          text not null,      -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  meal_name          text not null,
  ingredients        jsonb not null default '[]',
  plate_distribution jsonb not null default '{}',
  created_at         timestamptz not null default now()
);

comment on column public.meal_plans.ingredients        is 'Array of {name, amount, category} objects';
comment on column public.meal_plans.plate_distribution is 'Object with percentage breakdown, e.g. {vegetables:50, protein:30, carbs:20}';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ingredient_swaps
--    Reference table of known ingredient substitutions (not user-specific).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ingredient_swaps (
  id                     uuid primary key default gen_random_uuid(),
  original_ingredient    text not null,
  replacement_ingredient text not null,
  food_category          text,           -- e.g. 'protein', 'carbs', 'dairy'
  diet_type              text,           -- e.g. 'vegan', 'gluten_free'
  created_at             timestamptz not null default now()
);

comment on table public.ingredient_swaps is
  'Shared reference table of ingredient substitutions — readable by all authenticated users.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. workout_plans
--    One row per workout session (per user / week / day).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.workout_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  week_start   date not null,
  day_name     text not null,            -- e.g. 'monday'
  workout_type text,                     -- e.g. 'strength', 'cardio', 'rest'
  exercises    jsonb not null default '[]',
  notes        text,
  created_at   timestamptz not null default now()
);

comment on column public.workout_plans.exercises is
  'Array of {name, sets, reps, duration_sec, notes} objects';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. progress_logs
--    One row per user per calendar date (weight + daily adherence tracking).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.progress_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  log_date          date not null,
  weight_kg         real,
  workout_completed boolean not null default false,
  meals_followed    boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (user_id, log_date)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes  (for the most common query patterns)
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_meal_plans_user_week
  on public.meal_plans (user_id, week_start);

create index if not exists idx_meal_plans_day
  on public.meal_plans (user_id, week_start, day_name);

create index if not exists idx_workout_plans_user_week
  on public.workout_plans (user_id, week_start);

create index if not exists idx_progress_logs_user_date
  on public.progress_logs (user_id, log_date);

create index if not exists idx_ingredient_swaps_category
  on public.ingredient_swaps (food_category, diet_type);


-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.food_preferences  enable row level security;
alter table public.meal_plans        enable row level security;
alter table public.ingredient_swaps  enable row level security;
alter table public.workout_plans     enable row level security;
alter table public.progress_logs     enable row level security;

-- profiles — id IS the user's UUID
create policy "profiles: users manage own row"
  on public.profiles for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- food_preferences
create policy "food_preferences: users manage own row"
  on public.food_preferences for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- meal_plans
create policy "meal_plans: users manage own rows"
  on public.meal_plans for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ingredient_swaps — read-only for all signed-in users, no user writes
create policy "ingredient_swaps: authenticated users can read"
  on public.ingredient_swaps for select
  using (auth.role() = 'authenticated');

-- workout_plans
create policy "workout_plans: users manage own rows"
  on public.workout_plans for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- progress_logs
create policy "progress_logs: users manage own rows"
  on public.progress_logs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-create profile row on sign-up
--   Fires after every new auth.users insert and seeds profiles with the
--   display name the user provided during registration.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'first_name',
      new.email
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
