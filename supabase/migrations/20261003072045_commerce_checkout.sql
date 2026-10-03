-- Guest checkout is a deliberately bounded capability, not table write access.
-- SECURITY DEFINER code stays private; exposed wrappers use SECURITY INVOKER.
-- No guest can read customers/orders. Requests do not reserve stock until merchant confirmation.
create table public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  orders_enabled boolean not null default false,
  pickup_enabled boolean not null default false,
  delivery_enabled boolean not null default true,
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee between 0 and 99999),
  pickup_address text not null default '' check (char_length(pickup_address) <= 500),
  seo_title text not null default '' check (char_length(seo_title) <= 70),
  seo_description text not null default '' check (char_length(seo_description) <= 160),
  updated_at timestamptz not null default now(),
  check (not orders_enabled or pickup_enabled or delivery_enabled),
  check (not pickup_enabled or char_length(pickup_address) >= 5)
);
alter table public.store_settings enable row level security;
grant select on public.store_settings to anon, authenticated;
grant insert, update, delete on public.store_settings to authenticated;
create policy settings_guest_read on public.store_settings for select to anon
  using (private.store_is_published(store_id));
create policy settings_member_read on public.store_settings for select to authenticated
  using (private.is_store_member(store_id) or private.store_is_published(store_id));
create policy settings_insert on public.store_settings for insert to authenticated
  with check (private.has_store_role(store_id, array['owner','admin']::public.store_role[]));
create policy settings_update on public.store_settings for update to authenticated
  using (private.has_store_role(store_id, array['owner','admin']::public.store_role[]))
  with check (private.has_store_role(store_id, array['owner','admin']::public.store_role[]));
create policy settings_delete on public.store_settings for delete to authenticated
  using (private.has_store_role(store_id, array['owner','admin']::public.store_role[]));

alter table public.orders
  add column checkout_token uuid,
  add column request_digest text,
  add column buyer_name text not null default '',
  add column buyer_phone text not null default '',
  add column buyer_email text not null default '',
  add column buyer_note text not null default '',
  add column shipping_method text not null default 'delivery' check (shipping_method in ('pickup','delivery')),
  add column shipping_address text not null default '',
  add column inventory_reserved boolean not null default false,
  add constraint orders_checkout_token_unique unique (store_id, checkout_token);
create index orders_buyer_rate_idx on public.orders(store_id, buyer_phone, created_at desc);
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null,
  status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (order_id, store_id) references public.orders(id, store_id) on delete cascade
);
create index order_events_order_idx on public.order_events(order_id, store_id);
create index order_events_actor_idx on public.order_events(actor_id);
alter table public.order_events enable row level security;
grant select on public.order_events to authenticated;
revoke all on public.order_events from anon;
create policy events_read on public.order_events for select to authenticated
  using (private.has_store_role(store_id, array['owner','admin','manager','support']::public.store_role[]));
-- Status and inventory are a single transaction; direct updates would bypass that invariant.
revoke insert, update, delete on public.orders, public.order_items, public.order_events from anon, authenticated;

create function private.checkout_order(shop_slug text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  shop public.stores%rowtype; settings public.store_settings%rowtype;
  existing public.orders%rowtype; token uuid; fingerprint text;
  entry jsonb; variant public.product_variants%rowtype; product public.products%rowtype;
  order_id uuid := gen_random_uuid(); customer_id uuid := gen_random_uuid();
  qty integer; subtotal numeric := 0; fee numeric := 0; unit_price numeric;
  lines jsonb := '[]'::jsonb; phone text; total_units integer := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 20000
     or jsonb_typeof(payload->'items') <> 'array' then raise exception 'SC_INVALID'; end if;
  if jsonb_array_length(payload->'items') not between 1 and 30
     or coalesce(payload->>'consent','false') <> 'true'
     or char_length(coalesce(payload->>'name','')) not between 2 and 120
     or char_length(coalesce(payload->>'email','')) > 254
     or char_length(coalesce(payload->>'note','')) > 1000
     or char_length(coalesce(payload->>'address','')) > 500
     or coalesce(payload->>'method','') not in ('pickup','delivery') then raise exception 'SC_INVALID'; end if;
  phone := payload->>'phone';
  if phone is null or phone !~ '^[0-9]{10,15}$' then raise exception 'SC_INVALID'; end if;
  token := (payload->>'token')::uuid;
  if token is null then raise exception 'SC_INVALID'; end if;
  fingerprint := md5(payload::text);
  select * into shop from public.stores where slug = shop_slug for update;
  if not found then raise exception 'SC_CLOSED'; end if;
  select * into existing from public.orders where store_id = shop.id and checkout_token = token;
  if found then
    if existing.request_digest <> fingerprint then raise exception 'SC_RETRY'; end if;
    return jsonb_build_object('id',existing.id,'total',existing.total,'currency',existing.currency);
  end if;
  select * into settings from public.store_settings where store_id = shop.id;
  if not found or not settings.orders_enabled or shop.status <> 'active'
     or not exists(select 1 from public.storefronts where store_id = shop.id) then raise exception 'SC_CLOSED'; end if;
  if (payload->>'method' = 'pickup' and not settings.pickup_enabled)
     or (payload->>'method' = 'delivery' and (not settings.delivery_enabled or char_length(coalesce(payload->>'address','')) < 5)) then raise exception 'SC_DELIVERY'; end if;
  -- Database-side caps also apply to direct RPC calls; a production launch still needs bot protection.
  if (select count(*) from public.orders where store_id = shop.id and created_at > now() - interval '1 hour') >= 60
     or (select count(*) from public.orders where store_id = shop.id and buyer_phone = phone and created_at > now() - interval '5 minutes') >= 3 then raise exception 'SC_LIMIT'; end if;
  if (select count(distinct x->>'variantId') from jsonb_array_elements(payload->'items') x) <> jsonb_array_length(payload->'items') then raise exception 'SC_INVALID'; end if;
  for entry in select value from jsonb_array_elements(payload->'items') order by value->>'variantId' loop
    if jsonb_typeof(entry->'quantity') <> 'number' or (entry->>'quantity') !~ '^[0-9]{1,2}$' then raise exception 'SC_INVALID'; end if;
    qty := (entry->>'quantity')::integer;
    if qty not between 1 and 20 then raise exception 'SC_INVALID'; end if;
    total_units := total_units + qty;
    if total_units > 100 then raise exception 'SC_INVALID'; end if;
    select * into variant from public.product_variants where id = (entry->>'variantId')::uuid and store_id = shop.id for share;
    if not found or variant.inventory_quantity < qty then raise exception 'SC_STOCK'; end if;
    select * into product from public.products where id = variant.product_id and store_id = shop.id and status = 'active' for share;
    if not found then raise exception 'SC_STOCK'; end if;
    unit_price := coalesce(variant.price, product.price);
    subtotal := subtotal + qty * unit_price;
    lines := lines || jsonb_build_array(jsonb_build_object('product',product.id,'variant',variant.id,'title',product.name || ' · ' || variant.title,'quantity',qty,'price',unit_price));
  end loop;
  fee := case when payload->>'method' = 'delivery' then settings.shipping_fee else 0 end;
  insert into public.customers(id,store_id,first_name,phone,email) values(customer_id,shop.id,payload->>'name',phone,nullif(payload->>'email',''));
  insert into public.orders(id,store_id,customer_id,currency,subtotal,shipping_total,total,checkout_token,request_digest,buyer_name,buyer_phone,buyer_email,buyer_note,shipping_method,shipping_address)
  values(order_id,shop.id,customer_id,shop.currency,subtotal,fee,subtotal+fee,token,fingerprint,payload->>'name',phone,coalesce(payload->>'email',''),coalesce(payload->>'note',''),payload->>'method',case when payload->>'method' = 'pickup' then settings.pickup_address else payload->>'address' end);
  for entry in select value from jsonb_array_elements(lines) loop
    insert into public.order_items(store_id,order_id,product_id,variant_id,title,quantity,unit_price,line_total)
    values(shop.id,order_id,(entry->>'product')::uuid,(entry->>'variant')::uuid,entry->>'title',(entry->>'quantity')::integer,(entry->>'price')::numeric,(entry->>'quantity')::integer*(entry->>'price')::numeric);
  end loop;
  insert into public.order_events(store_id,order_id,status) values(shop.id,order_id,'new');
  return jsonb_build_object('id',order_id,'total',subtotal+fee,'currency',shop.currency);
end; $$;
revoke all on function private.checkout_order(text,jsonb) from public;
grant execute on function private.checkout_order(text,jsonb) to anon, authenticated;
create function public.checkout_order(shop_slug text, payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.checkout_order(shop_slug,payload); $$;
revoke all on function public.checkout_order(text,jsonb) from public;
grant execute on function public.checkout_order(text,jsonb) to anon, authenticated;

create function private.change_order_status(target_store uuid, target_order uuid, next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_order public.orders%rowtype; item record; variant public.product_variants%rowtype; allowed boolean;
begin
  if (select auth.uid()) is null or not private.has_store_role(target_store,array['owner','admin','manager']::public.store_role[]) then raise exception 'SC_DENIED'; end if;
  perform 1 from public.stores where id = target_store and status <> 'suspended' for share;
  if not found then raise exception 'SC_DENIED'; end if;
  select * into current_order from public.orders where id = target_order and store_id = target_store for update;
  if not found then raise exception 'SC_DENIED'; end if;
  if current_order.status = next_status then return; end if;
  allowed := case current_order.status
    when 'new' then next_status in ('confirmed','cancelled')
    when 'confirmed' then next_status in ('packing','cancelled')
    when 'packing' then next_status in ('shipped','completed','cancelled')
    when 'shipped' then next_status in ('completed','returned')
    when 'completed' then next_status = 'returned'
    else false end;
  if not coalesce(allowed,false) then raise exception 'SC_TRANSITION'; end if;
  if next_status = 'confirmed' or (next_status in ('cancelled','returned') and current_order.inventory_reserved) then
    for item in select * from public.order_items where order_id = target_order and store_id = target_store order by variant_id loop
      select * into variant from public.product_variants where id = item.variant_id and store_id = target_store for update;
      if not found then raise exception 'SC_STOCK'; end if;
      if next_status = 'confirmed' then
        if variant.inventory_quantity < item.quantity or not exists(select 1 from public.products where id = variant.product_id and store_id = target_store and status = 'active') then raise exception 'SC_STOCK'; end if;
        update public.product_variants set inventory_quantity = inventory_quantity - item.quantity where id = variant.id;
      else
        update public.product_variants set inventory_quantity = inventory_quantity + item.quantity where id = variant.id;
      end if;
    end loop;
  end if;
  update public.orders set status = next_status, updated_at = now(), inventory_reserved = case when next_status = 'confirmed' then true when next_status in ('cancelled','returned') then false else inventory_reserved end where id = target_order and store_id = target_store;
  insert into public.order_events(store_id,order_id,status,actor_id) values(target_store,target_order,next_status,(select auth.uid()));
end; $$;
revoke all on function private.change_order_status(uuid,uuid,text) from public, anon;
grant execute on function private.change_order_status(uuid,uuid,text) to authenticated;
create function public.change_order_status(target_store uuid, target_order uuid, next_status text)
returns void language sql security invoker set search_path = '' as $$ select private.change_order_status(target_store,target_order,next_status); $$;
revoke all on function public.change_order_status(uuid,uuid,text) from public, anon;
grant execute on function public.change_order_status(uuid,uuid,text) to authenticated;

create function public.order_summary(target_store uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('orders',count(*),'new_orders',count(*) filter(where status = 'new'),'completed_total',coalesce(sum(total) filter(where status = 'completed'),0)) from public.orders where store_id = target_store;
$$;
revoke all on function public.order_summary(uuid) from public, anon;
grant execute on function public.order_summary(uuid) to authenticated;

create function private.protect_reserved_variant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.order_items i join public.orders o on o.id = i.order_id and o.store_id = i.store_id where i.variant_id = old.id and i.store_id = old.store_id and o.inventory_reserved) then raise exception 'Variant belongs to reserved order'; end if;
  return old;
end; $$;
revoke all on function private.protect_reserved_variant() from public, anon, authenticated;
create trigger reserved_variant_delete_guard before delete on public.product_variants for each row execute function private.protect_reserved_variant();
