create extension if not exists pgcrypto;

create type public.store_role as enum ('owner', 'admin', 'manager', 'editor', 'support');
create type public.store_status as enum ('draft', 'active', 'suspended', 'archived');
create type public.product_status as enum ('draft', 'active', 'archived');

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  locale text not null default 'uk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  currency text not null default 'UAH' check (currency in ('UAH', 'USD', 'EUR', 'PLN')),
  locale text not null default 'uk' check (locale in ('uk', 'en', 'pl', 'de')),
  status public.store_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.store_role not null default 'support',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  parent_id uuid,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (store_id, slug),
  unique (id, store_id),
  foreign key (parent_id, store_id) references public.categories(id, store_id) on delete set null (parent_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid,
  name text not null,
  slug text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= price),
  sku text,
  status public.product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug),
  unique (id, store_id),
  foreign key (category_id, store_id) references public.categories(id, store_id) on delete set null (category_id)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null,
  title text not null,
  sku text,
  price numeric(12,2) check (price is null or price >= 0),
  inventory_quantity integer not null default 0 check (inventory_quantity >= 0),
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (store_id, sku),
  unique (id, store_id),
  foreign key (product_id, store_id) references public.products(id, store_id) on delete cascade
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now(),
  unique (id, store_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid,
  status text not null default 'new'
    check (status in ('new','awaiting_confirmation','confirmed','awaiting_payment','paid','packing','shipped','delivered','completed','cancelled','returned')),
  currency text not null default 'UAH' check (currency in ('UAH', 'USD', 'EUR', 'PLN')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  shipping_total numeric(12,2) not null default 0 check (shipping_total >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, store_id),
  foreign key (customer_id, store_id) references public.customers(id, store_id) on delete set null (customer_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null,
  product_id uuid,
  variant_id uuid,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  foreign key (order_id, store_id) references public.orders(id, store_id) on delete cascade,
  foreign key (product_id, store_id) references public.products(id, store_id) on delete set null (product_id),
  foreign key (variant_id, store_id) references public.product_variants(id, store_id) on delete set null (variant_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index store_members_user_id_idx on public.store_members(user_id);
create index categories_store_id_idx on public.categories(store_id);
create index products_store_status_idx on public.products(store_id, status);
create index product_variants_product_id_idx on public.product_variants(product_id, store_id);
create index customers_store_id_idx on public.customers(store_id);
create index orders_store_created_idx on public.orders(store_id, created_at desc);
create index order_items_order_idx on public.order_items(order_id, store_id);
create index audit_logs_store_created_idx on public.audit_logs(store_id, created_at desc);

create or replace function private.is_store_member(target_store uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.store_members sm
    where sm.store_id = target_store and sm.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_store_role(target_store uuid, allowed_roles public.store_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.store_members sm
    where sm.store_id = target_store
      and sm.user_id = (select auth.uid())
      and sm.role = any (allowed_roles)
  );
$$;

create or replace function private.store_is_published(target_store uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    where s.id = target_store and s.status = 'active'
  );
$$;

revoke all on function private.is_store_member(uuid) from public;
revoke all on function private.has_store_role(uuid, public.store_role[]) from public;
revoke all on function private.store_is_published(uuid) from public;
grant execute on function private.is_store_member(uuid) to authenticated;
grant execute on function private.has_store_role(uuid, public.store_role[]) to authenticated;
grant execute on function private.store_is_published(uuid) to anon, authenticated;

create or replace function private.bootstrap_store_owner()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.store_members (store_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
revoke all on function private.bootstrap_store_owner() from public;
create trigger stores_bootstrap_owner
  after insert on public.stores
  for each row execute procedure private.bootstrap_store_owner();

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.audit_logs enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.stores to authenticated;
grant select, insert, update, delete on public.store_members to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_variants to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.categories, public.products, public.product_variants to anon, authenticated;

create policy profiles_self on public.profiles for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy stores_member_read on public.stores for select to authenticated
  using (private.is_store_member(id));
create policy stores_owner_insert on public.stores for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy stores_admin_update on public.stores for update to authenticated
  using (private.has_store_role(id, array['owner','admin']::public.store_role[]))
  with check (private.has_store_role(id, array['owner','admin']::public.store_role[]));

create policy members_self_or_admin_read on public.store_members for select to authenticated
  using (user_id = (select auth.uid()) or private.has_store_role(store_id, array['owner','admin']::public.store_role[]));
create policy members_admin_insert on public.store_members for insert to authenticated
  with check (role <> 'owner' and private.has_store_role(store_id, array['owner','admin']::public.store_role[]));
create policy members_admin_update on public.store_members for update to authenticated
  using (role <> 'owner' and private.has_store_role(store_id, array['owner','admin']::public.store_role[]))
  with check (role <> 'owner' and private.has_store_role(store_id, array['owner','admin']::public.store_role[]));
create policy members_admin_delete on public.store_members for delete to authenticated
  using (role <> 'owner' and private.has_store_role(store_id, array['owner','admin']::public.store_role[]));

create policy categories_public_read on public.categories for select to anon
  using (private.store_is_published(store_id));
create policy categories_member_read on public.categories for select to authenticated
  using (private.is_store_member(store_id) or private.store_is_published(store_id));
create policy categories_write on public.categories for all to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[]))
  with check (private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[]));

create policy products_public_read on public.products for select to anon
  using (status = 'active' and private.store_is_published(store_id));
create policy products_member_read on public.products for select to authenticated
  using ((status = 'active' and private.store_is_published(store_id)) or private.is_store_member(store_id));
create policy products_write on public.products for all to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[]))
  with check (private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[]));

create policy variants_public_read on public.product_variants for select to anon
  using (exists (select 1 from public.products p where p.id = product_variants.product_id and p.store_id = product_variants.store_id and p.status = 'active' and private.store_is_published(product_variants.store_id)));
create policy variants_member_read on public.product_variants for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_variants.product_id and p.store_id = product_variants.store_id and p.status = 'active' and private.store_is_published(product_variants.store_id)) or private.is_store_member(store_id));
create policy variants_write on public.product_variants for all to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[]))
  with check (private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[]));

create policy customers_read on public.customers for select to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','support']::public.store_role[]));
create policy customers_write on public.customers for all to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','support']::public.store_role[]))
  with check (private.has_store_role(store_id, array['owner','admin','manager','support']::public.store_role[]));

create policy orders_read on public.orders for select to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','support']::public.store_role[]));
create policy orders_update on public.orders for update to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','support']::public.store_role[]))
  with check (private.has_store_role(store_id, array['owner','admin','manager','support']::public.store_role[]));
create policy order_items_read on public.order_items for select to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','support']::public.store_role[]));

create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (private.has_store_role(store_id, array['owner','admin']::public.store_role[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

create policy store_media_member_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.has_store_role(((storage.foldername(name))[1])::uuid, array['owner','admin','manager','editor']::public.store_role[])
  );
create policy store_media_member_update on storage.objects for update to authenticated
  using (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.has_store_role(((storage.foldername(name))[1])::uuid, array['owner','admin','manager','editor']::public.store_role[])
  )
  with check (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.has_store_role(((storage.foldername(name))[1])::uuid, array['owner','admin','manager','editor']::public.store_role[])
  );
create policy store_media_member_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.has_store_role(((storage.foldername(name))[1])::uuid, array['owner','admin','manager','editor']::public.store_role[])
  );
