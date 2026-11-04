-- =====================================================================
-- ORENGruz multi-tenant starter schema (Supabase / PostgreSQL)
-- Run once in Supabase Dashboard -> SQL Editor.
-- No service_role key is used in the browser. RLS controls tenant access.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  slug text primary key check (slug ~ '^[a-z0-9-]{3,50}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  tenant_slug text not null references public.tenants(slug) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager')),
  created_at timestamptz not null default now(),
  primary key (tenant_slug, user_id)
);

create index if not exists tenant_memberships_user_idx on public.tenant_memberships(user_id);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null references public.tenants(slug) on delete cascade,
  name text not null check (char_length(name) between 1 and 90),
  description text not null default '' check (char_length(description) <= 240),
  price_per_ton numeric(12,2) not null check (price_per_ton > 0 and price_per_ton <= 10000000),
  density numeric(6,3) not null check (density > 0 and density <= 10),
  image_path text check (image_path is null or image_path like (tenant_slug || '/%')),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists public.trucks (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null references public.tenants(slug) on delete cascade,
  name text not null check (char_length(name) between 1 and 90),
  description text not null default '' check (char_length(description) <= 240),
  max_tons numeric(7,2) not null check (max_tons > 0 and max_tons <= 100),
  base_delivery_price numeric(12,2) not null default 0 check (base_delivery_price >= 0 and base_delivery_price <= 10000000),
  class_key text not null default 'medium' check (class_key in ('small','medium','large')),
  side_unload boolean not null default false,
  image_path text check (image_path is null or image_path like (tenant_slug || '/%')),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, name)
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null references public.tenants(slug) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 90),
  price_small numeric(12,2) not null default 0 check (price_small >= 0 and price_small <= 10000000),
  price_medium numeric(12,2) not null default 0 check (price_medium >= 0 and price_medium <= 10000000),
  price_large numeric(12,2) not null default 0 check (price_large >= 0 and price_large <= 10000000),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, key)
);

-- Keep updated_at useful for support/debugging.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at before update on public.materials
for each row execute function public.set_updated_at();
drop trigger if exists trucks_set_updated_at on public.trucks;
create trigger trucks_set_updated_at before update on public.trucks
for each row execute function public.set_updated_at();
drop trigger if exists delivery_zones_set_updated_at on public.delivery_zones;
create trigger delivery_zones_set_updated_at before update on public.delivery_zones
for each row execute function public.set_updated_at();

-- Enable row-level security on every table exposed through the Data API.
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.materials enable row level security;
alter table public.trucks enable row level security;
alter table public.delivery_zones enable row level security;

-- Explicit least-privilege grants. A policy alone does not revoke table grants.
revoke all on public.tenants from anon, authenticated;
revoke all on public.tenant_memberships from anon, authenticated;
revoke all on public.materials from anon, authenticated;
revoke all on public.trucks from anon, authenticated;
revoke all on public.delivery_zones from anon, authenticated;
grant select on public.tenants to anon, authenticated;
grant select on public.tenant_memberships to anon, authenticated;
grant select on public.materials, public.trucks, public.delivery_zones to anon, authenticated;
grant insert, update, delete on public.materials, public.trucks, public.delivery_zones to authenticated;

-- Public storefronts can read active tenant records. An authenticated member
-- can also read inactive records in their own tenant from the admin panel.
drop policy if exists tenants_public_read on public.tenants;
create policy tenants_public_read on public.tenants
for select to anon, authenticated using (is_active = true);

drop policy if exists memberships_read_self on public.tenant_memberships;
create policy memberships_read_self on public.tenant_memberships
for select to anon, authenticated using (user_id = (select auth.uid()));

-- MATERIALS policies
drop policy if exists materials_read_active_or_member on public.materials;
create policy materials_read_active_or_member on public.materials
for select to anon, authenticated
using (
  (is_active = true and exists (
    select 1 from public.tenants t where t.slug = materials.tenant_slug and t.is_active = true
  ))
  or exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_slug = materials.tenant_slug and tm.user_id = (select auth.uid())
  )
);
drop policy if exists materials_insert_member on public.materials;
create policy materials_insert_member on public.materials
for insert to authenticated with check (exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_slug = materials.tenant_slug and tm.user_id = (select auth.uid())
));
drop policy if exists materials_update_member on public.materials;
create policy materials_update_member on public.materials
for update to authenticated
using (exists (select 1 from public.tenant_memberships tm where tm.tenant_slug = materials.tenant_slug and tm.user_id = (select auth.uid())))
with check (exists (select 1 from public.tenant_memberships tm where tm.tenant_slug = materials.tenant_slug and tm.user_id = (select auth.uid())));
drop policy if exists materials_delete_member on public.materials;
create policy materials_delete_member on public.materials
for delete to authenticated using (exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_slug = materials.tenant_slug and tm.user_id = (select auth.uid())
));

-- TRUCKS policies
drop policy if exists trucks_read_active_or_member on public.trucks;
create policy trucks_read_active_or_member on public.trucks
for select to anon, authenticated
using (
  (is_active = true and exists (select 1 from public.tenants t where t.slug = trucks.tenant_slug and t.is_active = true))
  or exists (select 1 from public.tenant_memberships tm where tm.tenant_slug = trucks.tenant_slug and tm.user_id = (select auth.uid()))
);
drop policy if exists trucks_insert_member on public.trucks;
create policy trucks_insert_member on public.trucks
for insert to authenticated with check (exists (
  select 1 from public.tenant_memberships tm where tm.tenant_slug = trucks.tenant_slug and tm.user_id = (select auth.uid())
));
drop policy if exists trucks_update_member on public.trucks;
create policy trucks_update_member on public.trucks
for update to authenticated
using (exists (select 1 from public.tenant_memberships tm where tm.tenant_slug = trucks.tenant_slug and tm.user_id = (select auth.uid())))
with check (exists (select 1 from public.tenant_memberships tm where tm.tenant_slug = trucks.tenant_slug and tm.user_id = (select auth.uid())));
drop policy if exists trucks_delete_member on public.trucks;
create policy trucks_delete_member on public.trucks
for delete to authenticated using (exists (
  select 1 from public.tenant_memberships tm where tm.tenant_slug = trucks.tenant_slug and tm.user_id = (select auth.uid())
));

-- DELIVERY ZONES policies
drop policy if exists zones_read_active_or_member on public.delivery_zones;
create policy zones_read_active_or_member on public.delivery_zones
for select to anon, authenticated
using (
  (is_active = true and exists (select 1 from public.tenants t where t.slug = delivery_zones.tenant_slug and t.is_active = true))
  or exists (select 1 from public.tenant_memberships tm where tm.tenant_slug = delivery_zones.tenant_slug and tm.user_id = (select auth.uid()))
);
drop policy if exists zones_insert_member on public.delivery_zones;
create policy zones_insert_member on public.delivery_zones
for insert to authenticated with check (exists (
  select 1 from public.tenant_memberships tm where tm.tenant_slug = delivery_zones.tenant_slug and tm.user_id = (select auth.uid())
));
drop policy if exists zones_update_member on public.delivery_zones;
create policy zones_update_member on public.delivery_zones
for update to authenticated
using (exists (select 1 from public.tenant_memberships tm where tm.tenant_slug = delivery_zones.tenant_slug and tm.user_id = (select auth.uid())))
with check (exists (select 1 from public.tenant_memberships tm where tm.tenant_slug = delivery_zones.tenant_slug and tm.user_id = (select auth.uid())));
drop policy if exists zones_delete_member on public.delivery_zones;
create policy zones_delete_member on public.delivery_zones
for delete to authenticated using (exists (
  select 1 from public.tenant_memberships tm where tm.tenant_slug = delivery_zones.tenant_slug and tm.user_id = (select auth.uid())
));

-- Public bucket for product/truck photos. Upload/edit/delete is restricted
-- to signed-in users whose membership matches the first folder in the path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-assets', 'tenant-assets', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists tenant_assets_public_read on storage.objects;
create policy tenant_assets_public_read on storage.objects
for select to anon, authenticated using (bucket_id = 'tenant-assets');
drop policy if exists tenant_assets_member_insert on storage.objects;
create policy tenant_assets_member_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'tenant-assets' and exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_slug = (storage.foldername(name))[1]
      and tm.user_id = (select auth.uid())
  )
);
drop policy if exists tenant_assets_member_update on storage.objects;
create policy tenant_assets_member_update on storage.objects
for update to authenticated
using (bucket_id = 'tenant-assets' and exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_slug = (storage.foldername(name))[1] and tm.user_id = (select auth.uid())
))
with check (bucket_id = 'tenant-assets' and exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_slug = (storage.foldername(name))[1] and tm.user_id = (select auth.uid())
));
drop policy if exists tenant_assets_member_delete on storage.objects;
create policy tenant_assets_member_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'tenant-assets' and exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_slug = (storage.foldername(name))[1]
      and tm.user_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------
-- DEMO TENANT + STARTER DATA. Run once; safe to re-run.
-- Replace this slug when provisioning a new company.
-- ---------------------------------------------------------------------
insert into public.tenants (slug, is_active)
values ('orengruz56', true)
on conflict (slug) do update set is_active = excluded.is_active;

insert into public.materials (tenant_slug, name, description, price_per_ton, density, sort_order)
values
  ('orengruz56','Песок речной','Мытый песок для бетона и стяжки',650,1.50,10),
  ('orengruz56','Песок карьерный','Для кладки, подушки и засыпки',480,1.45,20),
  ('orengruz56','Щебень 5–20 мм','Мелкий щебень для фундамента и бетона',1250,1.40,30),
  ('orengruz56','Щебень 20–40 мм','Средний щебень для парковки и заезда',1150,1.40,40),
  ('orengruz56','ПГС / ОПГС','Песчано-гравийная смесь',720,1.60,50),
  ('orengruz56','Чернозём','Плодородный слой для сада и участка',600,1.20,60)
on conflict (tenant_slug, name) do nothing;

insert into public.trucks (tenant_slug, name, description, max_tons, base_delivery_price, class_key, sort_order)
values
  ('orengruz56','ГАЗон / ЗИЛ Самосвал','Компактный самосвал для узких проездов СНТ',5,2000,'small',10),
  ('orengruz56','КАМАЗ Самосвал','Для стройки частного дома и фундамента',15,2500,'medium',20),
  ('orengruz56','Shacman 4-осный','Большой объём для отсыпки участка или дороги',30,4000,'large',30)
on conflict (tenant_slug, name) do nothing;

insert into public.delivery_zones (tenant_slug, key, name, price_small, price_medium, price_large, sort_order)
values
  ('orengruz56','city','Оренбург',2000,2500,4000,10),
  ('orengruz56','near_east','Пригородный / Нежинка',2400,3000,4600,20),
  ('orengruz56','near_south','Ивановка / Весенний',2300,2900,4500,30),
  ('orengruz56','near_north','Подгородняя Покровка',2400,3000,4600,40),
  ('orengruz56','dachi','СНТ Дубки / Ростоши',2500,3200,5000,50),
  ('orengruz56','far','Дальний пригород',3500,4300,6500,60)
on conflict (tenant_slug, key) do nothing;

-- ---------------------------------------------------------------------
-- OWNER ACCESS: after creating the owner's account in Supabase Auth,
-- copy that user's UUID and run this query with the real UUID:
-- insert into public.tenant_memberships (tenant_slug, user_id, role)
-- values ('orengruz56', 'PASTE-AUTH-USER-UUID-HERE', 'owner');
-- Do NOT allow public signups. Add memberships only from the SQL editor.
-- ---------------------------------------------------------------------
