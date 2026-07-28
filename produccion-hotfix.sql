-- ═══════════════════════════════════════════════════════════════════════════
--  HOTFIX PRODUCCIÓN — crear profile_change_events (enfriamiento de 24 h)
--  Ejecutar en el SQL Editor del proyecto Supabase de PRODUCCIÓN.
--
--  Motivo (verificado 28/07/2026): el CREATE de esta tabla vivía SOLO en un
--  comentario de artifacts/api-server/src/lib/cooldown.ts, así que nunca se
--  ejecutó ni se auto-crea al arrancar. Si falta en producción, el enfriamiento
--  de 24 h para cambios extremos (peso/objetivo) NO se aplica (el código falla
--  en abierto: no da error, pero deja pasar los cambios sin límite).
--
--  Comprobar antes si ya existe (devuelve NULL si falta):
--    select to_regclass('public.profile_change_events');
--
--  Este script es IDEMPOTENTE: si la tabla/políticas ya existen, no hace nada.
--  Solo esta tabla. deletion_logs (borrado RGPD) llegará con el arreglo GDPR
--  completo por el circuito normal (staging → main), no aquí.
-- ═══════════════════════════════════════════════════════════════════════════

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

-- Políticas (CREATE POLICY no admite IF NOT EXISTS → se envuelven en un bloque
-- que ignora el error si ya existen, para que el script sea idempotente).
do $$
begin
  begin
    create policy "Users can insert own profile change events"
      on public.profile_change_events for insert with check (auth.uid() = user_id);
  exception when duplicate_object then null;
  end;
  begin
    create policy "Users can read own profile change events"
      on public.profile_change_events for select using (auth.uid() = user_id);
  exception when duplicate_object then null;
  end;
end $$;
