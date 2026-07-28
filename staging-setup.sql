-- ═══════════════════════════════════════════════════════════════════════════
--  GoalIQ — Setup del Supabase de STAGING (ejecutar UNA vez, de arriba abajo)
--  Ejecutar en el SQL Editor del proyecto Supabase de STAGING (no producción).
--
--  Orden de bloques:
--    A) Esquema base (profiles, food_preferences, meal_plans, ingredient_swaps,
--       workout_plans, progress_logs, índices, RLS, trigger de alta).
--    B) RGPD (consent_log, beta_invite_codes, columnas de compliance, códigos beta).
--    C) dish_images (caché de imágenes de plato).
--    D) Versiones de plan (meal_plan_versions, workout_plan_versions).
--    E) Tablas que el servidor NO crea solo (verificado 28/07/2026):
--       deletion_logs y profile_change_events (ambas estaban solo como comentario
--       en el código → no se creaban → causaban 500 / fallos silenciosos).
--
--  Lo que NO está aquí (lo crea el propio servidor al arrancar/usar, verificado en
--  index.ts y las rutas): stripe_users, flex_days, workout_history,
--  workoutx_exercises, calendar_events, meal_logs (al arrancar) y strength_logs
--  (perezosa, al primer uso de /strength). Además, al arrancar PARCHEA
--  meal_plans/workout_plans a su forma real (columna JSONB `days`).
--
--  ⚠️ Bloques A y B son copia de supabase-schema.sql y de
--     artifacts/api-server/migrations/m9p2-rgpd-bloque1(.-seed).sql. Si esos
--     ficheros cambian, regenerar este archivo.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  BLOQUE A — ESQUEMA BASE  (de supabase-schema.sql)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. profiles — una fila por usuario. id = auth.users.id
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

-- 2. food_preferences — gustos, alergias e intolerancias por usuario
create table if not exists public.food_preferences (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users on delete cascade,
  liked_foods    jsonb not null default '[]',
  disliked_foods jsonb not null default '[]',
  allergies      jsonb not null default '[]',
  intolerances   jsonb not null default '[]',
  created_at     timestamptz not null default now()
);

-- 3. meal_plans — forma base (el servidor la PARCHEA a JSONB `days` al arrancar)
create table if not exists public.meal_plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  week_start         date not null,
  day_name           text not null,
  meal_type          text not null,
  meal_name          text not null,
  ingredients        jsonb not null default '[]',
  plate_distribution jsonb not null default '{}',
  created_at         timestamptz not null default now()
);

-- 4. ingredient_swaps — tabla de referencia (no por usuario)
create table if not exists public.ingredient_swaps (
  id                     uuid primary key default gen_random_uuid(),
  original_ingredient    text not null,
  replacement_ingredient text not null,
  food_category          text,
  diet_type              text,
  created_at             timestamptz not null default now()
);

-- 5. workout_plans — forma base (el servidor la PARCHEA a JSONB `days` al arrancar)
create table if not exists public.workout_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  week_start   date not null,
  day_name     text not null,
  workout_type text,
  exercises    jsonb not null default '[]',
  notes        text,
  created_at   timestamptz not null default now()
);

-- 6. progress_logs — una fila por usuario y fecha
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

-- Índices
create index if not exists idx_meal_plans_user_week on public.meal_plans (user_id, week_start);
create index if not exists idx_meal_plans_day on public.meal_plans (user_id, week_start, day_name);
create index if not exists idx_workout_plans_user_week on public.workout_plans (user_id, week_start);
create index if not exists idx_progress_logs_user_date on public.progress_logs (user_id, log_date);
create index if not exists idx_ingredient_swaps_category on public.ingredient_swaps (food_category, diet_type);

-- RLS — cada usuario solo su fila
alter table public.profiles          enable row level security;
alter table public.food_preferences  enable row level security;
alter table public.meal_plans        enable row level security;
alter table public.ingredient_swaps  enable row level security;
alter table public.workout_plans     enable row level security;
alter table public.progress_logs     enable row level security;

create policy "profiles: users manage own row"
  on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "food_preferences: users manage own row"
  on public.food_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_plans: users manage own rows"
  on public.meal_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ingredient_swaps: authenticated users can read"
  on public.ingredient_swaps for select using (auth.role() = 'authenticated');
create policy "workout_plans: users manage own rows"
  on public.workout_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress_logs: users manage own rows"
  on public.progress_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger: crea la fila de profiles al dar de alta un usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'first_name',
    new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();


-- ═══════════════════════════════════════════════════════════════════════════
--  BLOQUE B — RGPD  (de m9p2-rgpd-bloque1.sql + seed)
-- ═══════════════════════════════════════════════════════════════════════════

-- consent_log — registro inmutable de consentimientos
create table if not exists public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in
    ('terms_of_use','privacy_policy','medical_data_processing','ai_disclosure')),
  consent_version text not null default 'v1.0',
  accepted boolean not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_consent_log_user on public.consent_log(user_id, consent_type);
create index if not exists idx_consent_log_created on public.consent_log(created_at);
alter table public.consent_log enable row level security;
create policy "users_read_own_consents" on public.consent_log for select using (auth.uid() = user_id);
-- Sin políticas de UPDATE/DELETE = inmutable (solo service_role).

-- beta_invite_codes — códigos de invitación
create table if not exists public.beta_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by_admin text,
  used_by_user_id uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_beta_codes_code on public.beta_invite_codes(code) where used_by_user_id is null;
create index if not exists idx_beta_codes_used on public.beta_invite_codes(used_by_user_id);
alter table public.beta_invite_codes enable row level security;
-- Sin políticas = solo service_role (el servidor accede por pool superusuario).

-- Columnas de compliance en profiles
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists medical_consent_at timestamptz,
  add column if not exists ai_disclosure_acknowledged_at timestamptz,
  add column if not exists beta_code_used text,
  add column if not exists consent_version text default 'v1.0';

-- Códigos beta de prueba para STAGING (para el test de registro)
insert into public.beta_invite_codes (code, created_by_admin, notes, expires_at)
values
  ('STAGING-BETA-001', 'jose', 'staging', now() + interval '365 days'),
  ('STAGING-BETA-002', 'jose', 'staging', now() + interval '365 days'),
  ('STAGING-BETA-003', 'jose', 'staging', now() + interval '365 days')
on conflict (code) do nothing;


-- ═══════════════════════════════════════════════════════════════════════════
--  BLOQUE C — dish_images  (caché compartida de imágenes de plato)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.dish_images (
  cache_key   text primary key,                 -- nombre_normalizado--hash_ingredientes
  url         text,
  meal_name   text,
  status      text not null default 'ready',     -- 'ready' | 'failed'
  fail_count  int  not null default 0,           -- anti-bucle
  cost_eur    numeric(8,4) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.dish_images enable row level security;
-- Sin políticas: solo el servidor (pool superusuario) accede. Caché compartida.


-- ═══════════════════════════════════════════════════════════════════════════
--  BLOQUE D — Versiones de plan  (auditoría legal; solo service_role)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.meal_plan_versions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  version_number    int  not null,
  week_start        date not null,
  plan_data         jsonb not null,
  profile_snapshot  jsonb not null,
  ai_model          text not null,
  ai_attempts       int  not null default 1,
  moderation_result jsonb not null,
  status            text not null default 'active' check (status in ('active','superseded','archived')),
  generated_at      timestamptz not null default now(),
  superseded_at     timestamptz,
  archived_at       timestamptz,
  constraint meal_plan_versions_user_version_unique unique (user_id, version_number)
);
create unique index if not exists meal_plan_versions_one_active_per_user
  on public.meal_plan_versions (user_id) where status = 'active';
alter table public.meal_plan_versions enable row level security;

create table if not exists public.workout_plan_versions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  version_number    int  not null,
  week_start        date not null,
  plan_data         jsonb not null,
  profile_snapshot  jsonb not null,
  ai_model          text not null,
  ai_attempts       int  not null default 1,
  moderation_result jsonb not null,
  status            text not null default 'active' check (status in ('active','superseded','archived')),
  generated_at      timestamptz not null default now(),
  superseded_at     timestamptz,
  archived_at       timestamptz,
  constraint workout_plan_versions_user_version_unique unique (user_id, version_number)
);
create unique index if not exists workout_plan_versions_one_active_per_user
  on public.workout_plan_versions (user_id) where status = 'active';
alter table public.workout_plan_versions enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
--  BLOQUE E — Tablas que el servidor NO crea solo (verificado 28/07/2026)
-- ═══════════════════════════════════════════════════════════════════════════

-- deletion_logs — auditoría de borrados RGPD. La usa DELETE /api/account.
-- IMPORTANTE: deleted_user_id NO lleva FK a auth.users (el log debe sobrevivir
-- al borrado del usuario). Sin esta tabla, el borrado de cuenta da 500.
create table if not exists public.deletion_logs (
  id                 uuid primary key default gen_random_uuid(),
  deleted_user_email text,
  deleted_user_id    uuid,
  deletion_reason    text,
  deletion_method    text,
  metadata           jsonb,
  created_at         timestamptz not null default now()
);
alter table public.deletion_logs enable row level security;
-- Sin políticas: solo service_role / pool superusuario.

-- profile_change_events — la usa el enfriamiento de 24 h (cooldown.ts). Su
-- CREATE estaba solo en un COMENTARIO del código → NO se creaba sola.
create table if not exists public.profile_change_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  changed_fields text[] not null,
  source         text not null check (source in ('onboarding_edit','profile_patch')),
  created_at     timestamptz not null default now()
);
create index if not exists profile_change_events_user_created_idx
  on public.profile_change_events (user_id, created_at desc);
alter table public.profile_change_events enable row level security;
create policy "Users can insert own profile change events"
  on public.profile_change_events for insert with check (auth.uid() = user_id);
create policy "Users can read own profile change events"
  on public.profile_change_events for select using (auth.uid() = user_id);

-- NOTA: strength_logs NO se incluye aquí a propósito. El servidor la crea sola,
-- con la forma correcta (id SERIAL, user_id TEXT, weight_kg DECIMAL NOT NULL…),
-- al primer uso de /strength. Copiarla aquí arriesgaba una definición divergente
-- que el IF NOT EXISTS del servidor no corregiría.

-- ═══════════════════════════════════════════════════════════════════════════
--  FIN. Arranca el servidor de staging apuntando a este Supabase para que
--  auto-cree/parchee el resto (stripe_users, flex_days, workout_history,
--  workoutx_exercises, calendar_events, meal_logs, strength_logs, y el JSONB `days`).
-- ═══════════════════════════════════════════════════════════════════════════
