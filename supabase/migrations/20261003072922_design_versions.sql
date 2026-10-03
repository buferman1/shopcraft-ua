create table public.store_design_versions (
  store_id uuid not null references public.stores(id) on delete cascade,
  revision bigint not null check(revision > 0),
  config jsonb not null check(jsonb_typeof(config) = 'object' and octet_length(config::text) <= 65536),
  created_at timestamptz not null default now(),
  primary key(store_id,revision)
);
alter table public.store_design_versions enable row level security;
revoke all on public.store_design_versions from anon, authenticated;
grant select on public.store_design_versions to authenticated;
create policy versions_team_read on public.store_design_versions for select to authenticated
  using(private.is_store_member(store_id));
create function private.record_design_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.store_design_versions(store_id,revision,config) values(new.store_id,new.revision,new.config) on conflict do nothing;
  delete from public.store_design_versions where store_id = new.store_id and revision not in
    (select revision from public.store_design_versions where store_id = new.store_id order by revision desc limit 30);
  return new;
end; $$;
revoke all on function private.record_design_version() from public, anon, authenticated;
create trigger design_version_history after insert or update on public.store_designs for each row execute function private.record_design_version();
insert into public.store_design_versions(store_id,revision,config) select store_id,revision,config from public.store_designs;
