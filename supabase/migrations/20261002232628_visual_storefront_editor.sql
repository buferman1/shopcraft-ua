-- Drafts are member-only. A separate public snapshot never exposes unsaved text.
create table public.store_designs (
  store_id uuid primary key references public.stores(id) on delete cascade,
  config jsonb not null check (jsonb_typeof(config) = 'object' and config->>'version' = '1' and config->>'theme' in ('minimal','street','boutique') and octet_length(config::text) <= 65536),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
create table public.storefronts (
  store_id uuid primary key references public.stores(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  currency text not null check (currency in ('UAH','USD','EUR','PLN')),
  config jsonb not null check (jsonb_typeof(config) = 'object' and config->>'version' = '1' and config->>'theme' in ('minimal','street','boutique') and octet_length(config::text) <= 65536),
  revision bigint not null check (revision > 0),
  published_at timestamptz not null default now()
);
alter table public.store_designs enable row level security;
alter table public.storefronts enable row level security;
grant select, insert, update on public.store_designs to authenticated;
grant select on public.storefronts to anon, authenticated;
grant insert, update, delete on public.storefronts to authenticated;

create policy design_member_read on public.store_designs for select to authenticated using (private.is_store_member(store_id));
create policy design_member_insert on public.store_designs for insert to authenticated with check (
  private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
);
create policy design_member_update on public.store_designs for update to authenticated using (
  private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
) with check (
  private.has_store_role(store_id, array['owner','admin','manager','editor']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
);
create policy storefront_public_read on public.storefronts for select to anon using (private.store_is_published(store_id));
create policy storefront_member_read on public.storefronts for select to authenticated using (private.store_is_published(store_id) or private.is_store_member(store_id));
create policy storefront_admin_write on public.storefronts for all to authenticated using (
  private.has_store_role(store_id, array['owner','admin']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
) with check (
  private.has_store_role(store_id, array['owner','admin']::public.store_role[])
  and exists (select 1 from public.stores s where s.id=store_id and s.status<>'suspended')
);

create function public.save_store_design(target_store uuid, new_config jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare saved_revision bigint;
begin
  if (select auth.uid()) is null or not private.has_store_role(target_store, array['owner','admin','manager','editor']::public.store_role[]) then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  if expected_revision=0 then
    insert into public.store_designs(store_id,config) values(target_store,new_config)
    on conflict(store_id) do nothing returning revision into saved_revision;
  elsif expected_revision>0 then
    update public.store_designs set config=new_config, revision=revision+1, updated_at=now()
    where store_id=target_store and revision=expected_revision returning revision into saved_revision;
  end if;
  if saved_revision is null then raise exception 'Design revision conflict' using errcode='40001'; end if;
  return saved_revision;
end;
$$;
revoke all on function public.save_store_design(uuid,jsonb,bigint) from public;
grant execute on function public.save_store_design(uuid,jsonb,bigint) to authenticated;

-- Publication and store status change in one transaction, under the caller's RLS.
create function public.publish_store_design(target_store uuid, expected_revision bigint, make_public boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare draft_config jsonb; draft_revision bigint; shop public.stores%rowtype;
begin
  if (select auth.uid()) is null or not private.has_store_role(target_store, array['owner','admin']::public.store_role[]) then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  select config,revision into draft_config,draft_revision from public.store_designs where store_id=target_store for update;
  if not found or draft_revision<>expected_revision then raise exception 'Design revision conflict' using errcode='40001'; end if;
  select * into shop from public.stores where id=target_store for update;
  if not found or shop.status='suspended' then raise exception 'Not allowed' using errcode='42501'; end if;
  if make_public then
    insert into public.storefronts(store_id,slug,name,currency,config,revision,published_at)
    values(target_store,shop.slug,shop.name,shop.currency,draft_config,draft_revision,now())
    on conflict(store_id) do update set slug=excluded.slug,name=excluded.name,currency=excluded.currency,config=excluded.config,revision=excluded.revision,published_at=excluded.published_at;
    update public.stores set status='active',updated_at=now() where id=target_store;
  else
    delete from public.storefronts where store_id=target_store;
    update public.stores set status='draft',updated_at=now() where id=target_store;
  end if;
end;
$$;
revoke all on function public.publish_store_design(uuid,bigint,boolean) from public;
grant execute on function public.publish_store_design(uuid,bigint,boolean) to authenticated;
create trigger audit_design after insert or update on public.store_designs for each row execute function private.audit_catalog_change();
create trigger audit_publication after insert or update on public.storefronts for each row execute function private.audit_catalog_change();
