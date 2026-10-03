begin;
select set_config('test.owner',gen_random_uuid()::text,true),set_config('test.other',gen_random_uuid()::text,true),set_config('test.shop',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.owner')::uuid,current_setting('test.owner')||'@example.invalid'),(current_setting('test.other')::uuid,current_setting('test.other')||'@example.invalid');
insert into public.stores(id,owner_id,name,slug) values(current_setting('test.shop')::uuid,current_setting('test.owner')::uuid,'Versions QA','qa-'||current_setting('test.shop'));
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
do $$ declare rev bigint := 0; n integer; begin
  for n in 1..35 loop
    rev := public.save_store_design(current_setting('test.shop')::uuid,jsonb_build_object('version',1,'theme','minimal','brandName','Version '||n),rev);
  end loop;
  if (select count(*) from public.store_design_versions where store_id=current_setting('test.shop')::uuid) <> 30 then raise exception 'Version retention failed'; end if;
  if (select min(revision) from public.store_design_versions where store_id=current_setting('test.shop')::uuid) <> 6 then raise exception 'Wrong versions pruned'; end if;
  if exists(select 1 from public.storefronts where store_id=current_setting('test.shop')::uuid) then raise exception 'Draft auto-published'; end if;
  begin
    insert into public.store_design_versions(store_id,revision,config) values(current_setting('test.shop')::uuid,999,'{}');
    raise exception 'History can be forged';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.store_design_versions where store_id=current_setting('test.shop')::uuid) then raise exception 'History leaked across tenants'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
  begin
    perform 1 from public.store_design_versions;
    raise exception 'Guest can read history';
  exception when insufficient_privilege then null; end;
end $$;
select 'PASS: immutable private history, retention of 30 revisions, no implicit publication, tenant isolation' as result;
rollback;
