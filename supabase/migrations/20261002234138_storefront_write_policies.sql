-- Keep the public/member SELECT policy separate from mutation authorization.
-- FOR ALL would also run a second permissive SELECT policy on every read.
drop policy storefront_admin_write on public.storefronts;
create policy storefront_admin_insert on public.storefronts for insert to authenticated with check (
  private.has_store_role(store_id, array['owner','admin']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
);
create policy storefront_admin_update on public.storefronts for update to authenticated using (
  private.has_store_role(store_id, array['owner','admin']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
) with check (
  private.has_store_role(store_id, array['owner','admin']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
);
create policy storefront_admin_delete on public.storefronts for delete to authenticated using (
  private.has_store_role(store_id, array['owner','admin']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
);
