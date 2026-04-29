-- ContaBliza - esquema inicial Supabase
-- Ejecutar en Supabase Dashboard > SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  document_type text,
  document_number text,
  plan text not null default 'free',
  subscription_status text not null default 'trialing',
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '60 days'),
  subscription_provider text,
  subscription_id text,
  payment_method_label text,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists subscription_status text not null default 'trialing',
  add column if not exists trial_started_at timestamptz not null default now(),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '60 days'),
  add column if not exists subscription_provider text,
  add column if not exists subscription_id text,
  add column if not exists payment_method_label text,
  add column if not exists current_period_ends_at timestamptz;

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  moneda text not null default 'UYU',
  medios jsonb not null default '[]'::jsonb,
  categorias jsonb not null default '[]'::jsonb,
  formato_fecha text not null default 'YYYY-MM-DD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto numeric(14,2) not null check (monto > 0),
  moneda text not null default 'UYU',
  fecha date not null,
  concepto text not null,
  medio_id text not null,
  categoria text,
  factura text,
  adjunto_path text,
  adjunto_name text,
  adjunto_mime text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'otro',
  currency text not null default 'USD',
  target numeric(14,2) not null check (target > 0),
  saved numeric(14,2) not null default 0 check (saved >= 0),
  monthly numeric(14,2) not null default 0 check (monthly >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendario_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null default 'RECORDATORIO',
  fecha date not null,
  descripcion text not null,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'LISTO')),
  monto numeric(14,2) not null default 0 check (monto >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adjuntos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movimiento_id uuid references public.movimientos(id) on delete cascade,
  bucket text not null default 'comprobantes',
  path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

drop trigger if exists set_movimientos_updated_at on public.movimientos;
create trigger set_movimientos_updated_at
before update on public.movimientos
for each row execute function public.set_updated_at();

drop trigger if exists set_metas_updated_at on public.metas;
create trigger set_metas_updated_at
before update on public.metas
for each row execute function public.set_updated_at();

drop trigger if exists set_calendario_eventos_updated_at on public.calendario_eventos;
create trigger set_calendario_eventos_updated_at
before update on public.calendario_eventos
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    document_type,
    document_number,
    plan,
    subscription_status,
    trial_started_at,
    trial_ends_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'document_type',
    new.raw_user_meta_data->>'document_number',
    'free',
    'trialing',
    now(),
    now() + interval '60 days'
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id, moneda, medios, categorias)
  values (
    new.id,
    'UYU',
    '[{"id":"caja","name":"Efectivo"},{"id":"banco","name":"Tarjeta Débito"},{"id":"tarjeta","name":"Tarjeta de Crédito"}]'::jsonb,
    '["Ventas","Compras","Servicios","Impuestos","Sueldos","Otros"]'::jsonb
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.has_active_app_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and (
        (
          p.plan in ('pro', 'premium')
          and p.subscription_status in ('active', 'paid')
          and (p.current_period_ends_at is null or p.current_period_ends_at >= now())
        )
        or (
          p.subscription_status = 'trialing'
          and p.trial_ends_at >= now()
        )
      )
  );
$$;

create or replace function public.protect_profile_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and auth.role() <> 'service_role' then
    new.plan = 'free';
    new.subscription_status = 'trialing';
    new.subscription_provider = null;
    new.subscription_id = null;
    new.payment_method_label = null;
    new.current_period_ends_at = null;
    new.trial_started_at = coalesce(new.trial_started_at, now());
    new.trial_ends_at = coalesce(new.trial_ends_at, new.trial_started_at + interval '60 days');
    return new;
  end if;

  if auth.role() <> 'service_role' and (
    old.plan is distinct from new.plan
    or old.subscription_status is distinct from new.subscription_status
    or old.trial_started_at is distinct from new.trial_started_at
    or old.trial_ends_at is distinct from new.trial_ends_at
    or old.subscription_provider is distinct from new.subscription_provider
    or old.subscription_id is distinct from new.subscription_id
    or old.payment_method_label is distinct from new.payment_method_label
    or old.current_period_ends_at is distinct from new.current_period_ends_at
  ) then
    raise exception 'billing fields can only be changed by the backend';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_billing_fields on public.profiles;
create trigger protect_profile_billing_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_billing_fields();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.movimientos enable row level security;
alter table public.metas enable row level security;
alter table public.calendario_eventos enable row level security;
alter table public.adjuntos enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "settings_all_own" on public.settings;
create policy "settings_all_own" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "movimientos_all_own" on public.movimientos;
drop policy if exists "movimientos_select_own" on public.movimientos;
create policy "movimientos_select_own" on public.movimientos
  for select using (auth.uid() = user_id);
drop policy if exists "movimientos_insert_active_own" on public.movimientos;
create policy "movimientos_insert_active_own" on public.movimientos
  for insert with check (auth.uid() = user_id and public.has_active_app_access(auth.uid()));
drop policy if exists "movimientos_update_active_own" on public.movimientos;
create policy "movimientos_update_active_own" on public.movimientos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.has_active_app_access(auth.uid()));
drop policy if exists "movimientos_delete_own" on public.movimientos;
create policy "movimientos_delete_own" on public.movimientos
  for delete using (auth.uid() = user_id);

drop policy if exists "metas_all_own" on public.metas;
drop policy if exists "metas_select_own" on public.metas;
create policy "metas_select_own" on public.metas
  for select using (auth.uid() = user_id);
drop policy if exists "metas_insert_active_own" on public.metas;
create policy "metas_insert_active_own" on public.metas
  for insert with check (auth.uid() = user_id and public.has_active_app_access(auth.uid()));
drop policy if exists "metas_update_active_own" on public.metas;
create policy "metas_update_active_own" on public.metas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.has_active_app_access(auth.uid()));
drop policy if exists "metas_delete_own" on public.metas;
create policy "metas_delete_own" on public.metas
  for delete using (auth.uid() = user_id);

drop policy if exists "calendario_eventos_all_own" on public.calendario_eventos;
drop policy if exists "calendario_eventos_select_own" on public.calendario_eventos;
create policy "calendario_eventos_select_own" on public.calendario_eventos
  for select using (auth.uid() = user_id);
drop policy if exists "calendario_eventos_insert_active_own" on public.calendario_eventos;
create policy "calendario_eventos_insert_active_own" on public.calendario_eventos
  for insert with check (auth.uid() = user_id and public.has_active_app_access(auth.uid()));
drop policy if exists "calendario_eventos_update_active_own" on public.calendario_eventos;
create policy "calendario_eventos_update_active_own" on public.calendario_eventos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.has_active_app_access(auth.uid()));
drop policy if exists "calendario_eventos_delete_own" on public.calendario_eventos;
create policy "calendario_eventos_delete_own" on public.calendario_eventos
  for delete using (auth.uid() = user_id);

drop policy if exists "adjuntos_all_own" on public.adjuntos;
drop policy if exists "adjuntos_select_own" on public.adjuntos;
create policy "adjuntos_select_own" on public.adjuntos
  for select using (auth.uid() = user_id);
drop policy if exists "adjuntos_insert_active_own" on public.adjuntos;
create policy "adjuntos_insert_active_own" on public.adjuntos
  for insert with check (auth.uid() = user_id and public.has_active_app_access(auth.uid()));
drop policy if exists "adjuntos_update_active_own" on public.adjuntos;
create policy "adjuntos_update_active_own" on public.adjuntos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.has_active_app_access(auth.uid()));
drop policy if exists "adjuntos_delete_own" on public.adjuntos;
create policy "adjuntos_delete_own" on public.adjuntos
  for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_comprobantes_select_own" on storage.objects;
create policy "storage_comprobantes_select_own" on storage.objects
  for select using (
    bucket_id = 'comprobantes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "storage_comprobantes_insert_own" on storage.objects;
create policy "storage_comprobantes_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'comprobantes'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.has_active_app_access(auth.uid())
  );

drop policy if exists "storage_comprobantes_update_own" on storage.objects;
create policy "storage_comprobantes_update_own" on storage.objects
  for update using (
    bucket_id = 'comprobantes'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'comprobantes'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.has_active_app_access(auth.uid())
  );

drop policy if exists "storage_comprobantes_delete_own" on storage.objects;
create policy "storage_comprobantes_delete_own" on storage.objects
  for delete using (
    bucket_id = 'comprobantes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
