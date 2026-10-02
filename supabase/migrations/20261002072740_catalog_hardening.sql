-- Index referencing columns to support tenant queries and FK checks.
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index categories_parent_store_idx on public.categories(parent_id,store_id);
create index customers_user_id_idx on public.customers(user_id);
create index order_items_product_store_idx on public.order_items(product_id,store_id);
create index order_items_store_idx on public.order_items(store_id);
create index order_items_variant_store_idx on public.order_items(variant_id,store_id);
create index orders_customer_store_idx on public.orders(customer_id,store_id);
create index products_category_store_idx on public.products(category_id,store_id);
create index stores_owner_idx on public.stores(owner_id);

-- Read policies remain separate from mutation policies.
drop policy categories_write on public.categories;
drop policy products_write on public.products;
drop policy variants_write on public.product_variants;
drop policy customers_write on public.customers;
do $$
declare table_name text; allowed_roles text;
begin
 foreach table_name in array array['categories','products','product_variants','customers'] loop
  allowed_roles := case when table_name='customers' then 'array[''owner'',''admin'',''manager'',''support'']::public.store_role[]' else 'array[''owner'',''admin'',''manager'',''editor'']::public.store_role[]' end;
  execute format('create policy %I on public.%I for insert to authenticated with check (private.has_store_role(store_id,%s))',table_name||'_insert',table_name,allowed_roles);
  execute format('create policy %I on public.%I for update to authenticated using (private.has_store_role(store_id,%s)) with check (private.has_store_role(store_id,%s))',table_name||'_update',table_name,allowed_roles,allowed_roles);
  execute format('create policy %I on public.%I for delete to authenticated using (private.has_store_role(store_id,%s))',table_name||'_delete',table_name,allowed_roles);
 end loop;
end $$;

create table public.product_images (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 product_id uuid not null,
 path text not null unique check (path like store_id::text || '/%'),
 alt text not null default '',
 position integer not null default 0 check (position>=0),
 created_at timestamptz not null default now(),
 foreign key(product_id,store_id) references public.products(id,store_id) on delete cascade
);
create index product_images_product_store_idx on public.product_images(product_id,store_id);
create index product_images_store_idx on public.product_images(store_id);
alter table public.product_images enable row level security;
grant select on public.product_images to anon,authenticated;
grant insert,update,delete on public.product_images to authenticated;
create policy product_images_public_read on public.product_images for select to anon using (
 exists(select 1 from public.products p where p.id=product_id and p.store_id=product_images.store_id and p.status='active' and private.store_is_published(p.store_id))
);
create policy product_images_read on public.product_images for select to authenticated using (
 private.is_store_member(store_id) or exists(select 1 from public.products p where p.id=product_id and p.store_id=product_images.store_id and p.status='active' and private.store_is_published(p.store_id))
);
create policy product_images_insert on public.product_images for insert to authenticated with check(private.has_store_role(store_id,array['owner','admin','manager','editor']::public.store_role[]));
create policy product_images_update on public.product_images for update to authenticated using(private.has_store_role(store_id,array['owner','admin','manager','editor']::public.store_role[])) with check(private.has_store_role(store_id,array['owner','admin','manager','editor']::public.store_role[]));
create policy product_images_delete on public.product_images for delete to authenticated using(private.has_store_role(store_id,array['owner','admin','manager','editor']::public.store_role[]));

create policy store_media_member_read on storage.objects for select to authenticated using (
 bucket_id='store-media' and private.is_store_member(case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ((storage.foldername(name))[1])::uuid else null end)
);

-- Ownership transfer and suspension changes are reserved for a separate privileged flow.
create function private.protect_store_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if (select auth.uid()) is not null then
  if new.owner_id is distinct from old.owner_id then raise exception 'Store ownership is immutable through the client API'; end if;
  if new.status='suspended' or old.status='suspended' then raise exception 'Suspension is managed by platform administrators'; end if;
 end if;
 return new;
end $$;
revoke all on function private.protect_store_identity() from public;
create trigger protect_store_identity before update on public.stores for each row execute function private.protect_store_identity();

create function private.audit_catalog_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; tenant uuid;
begin
 if (select auth.uid()) is null then return null; end if;
 row_data := case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 tenant := case when TG_TABLE_NAME='stores' then (row_data->>'id')::uuid else (row_data->>'store_id')::uuid end;
 insert into public.audit_logs(store_id,actor_id,action,entity_type,entity_id)
 values(tenant,(select auth.uid()),lower(TG_OP),TG_TABLE_NAME,(row_data->>'id')::uuid);
 return null;
end $$;
revoke all on function private.audit_catalog_change() from public;
do $$ declare table_name text; begin
 foreach table_name in array array['stores','products','categories','product_variants','product_images'] loop
  execute format('create trigger audit_catalog after insert or update on public.%I for each row execute function private.audit_catalog_change()',table_name);
 end loop;
end $$;
