begin;
select set_config('test.design_owner',gen_random_uuid()::text,true),set_config('test.design_other',gen_random_uuid()::text,true),set_config('test.design_store',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.design_owner')::uuid,current_setting('test.design_owner')||'@example.invalid'),(current_setting('test.design_other')::uuid,current_setting('test.design_other')||'@example.invalid');
insert into public.stores(id,owner_id,name,slug) values(current_setting('test.design_store')::uuid,current_setting('test.design_owner')::uuid,'Design isolation','design-'||current_setting('test.design_store'));
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.design_owner'),'role','authenticated')::text,true);
do $$ declare rev bigint; begin
 rev:=public.save_store_design(current_setting('test.design_store')::uuid,'{"version":1,"theme":"minimal","brandName":"Published title"}',0);
 if rev<>1 then raise exception 'First revision is incorrect'; end if;
 begin
  perform public.save_store_design(current_setting('test.design_store')::uuid,'{"version":1,"theme":"street"}',0);
  raise exception 'Concurrent create was not rejected';
 exception when serialization_failure then null; end;
 perform public.publish_store_design(current_setting('test.design_store')::uuid,1,true);
 rev:=public.save_store_design(current_setting('test.design_store')::uuid,'{"version":1,"theme":"boutique","brandName":"Private draft"}',1);
 if rev<>2 then raise exception 'Update revision is incorrect'; end if;
 begin
  perform public.publish_store_design(current_setting('test.design_store')::uuid,1,true);
  raise exception 'Stale publish was not rejected';
 exception when serialization_failure then null; end;
 begin
  perform public.save_store_design(current_setting('test.design_store')::uuid,'{"version":1,"theme":"street"}',1);
  raise exception 'Stale save was not rejected';
 exception when serialization_failure then null; end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if (select config->>'brandName' from public.storefronts where store_id=current_setting('test.design_store')::uuid)<>'Published title' then raise exception 'Draft changed published snapshot'; end if;
 begin
  if exists(select 1 from public.store_designs where store_id=current_setting('test.design_store')::uuid) then raise exception 'Anonymous visitor can read drafts'; end if;
 exception when insufficient_privilege then null; end;
 begin
  perform public.publish_store_design(current_setting('test.design_store')::uuid,2,true);
  raise exception 'Anonymous publication allowed';
 exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.design_other'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.store_designs where store_id=current_setting('test.design_store')::uuid) then raise exception 'Other tenant can read draft'; end if;
 begin
  perform public.save_store_design(current_setting('test.design_store')::uuid,'{"version":1,"theme":"street"}',2);
  raise exception 'Other tenant can write draft';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.store_members(store_id,user_id,role) values(current_setting('test.design_store')::uuid,current_setting('test.design_other')::uuid,'support');
set local role authenticated;
do $$ begin
 begin
  perform public.save_store_design(current_setting('test.design_store')::uuid,'{"version":1,"theme":"street"}',2);
  raise exception 'Support can edit design';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.store_members set role='editor' where store_id=current_setting('test.design_store')::uuid and user_id=current_setting('test.design_other')::uuid;
set local role authenticated;
do $$ begin
 perform public.save_store_design(current_setting('test.design_store')::uuid,'{"version":1,"theme":"street","brandName":"Editor draft"}',2);
 begin
  perform public.publish_store_design(current_setting('test.design_store')::uuid,3,true);
  raise exception 'Editor can publish';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.design_owner'),'role','authenticated')::text,true);
select public.publish_store_design(current_setting('test.design_store')::uuid,3,false);
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if exists(select 1 from public.storefronts where store_id=current_setting('test.design_store')::uuid) then raise exception 'Unpublished snapshot visible'; end if;
end $$;
select 'PASS: private drafts, published snapshot, revision conflicts, tenant isolation, support/editor permissions and unpublication' as result;
rollback;
