begin;
select set_config('test.user_a',gen_random_uuid()::text,true),set_config('test.user_b',gen_random_uuid()::text,true),set_config('test.store_a',gen_random_uuid()::text,true),set_config('test.store_b',gen_random_uuid()::text,true),set_config('test.product_a',gen_random_uuid()::text,true),set_config('test.category_b',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.user_a')::uuid,current_setting('test.user_a')||'@example.invalid'),(current_setting('test.user_b')::uuid,current_setting('test.user_b')||'@example.invalid');
insert into public.stores(id,owner_id,name,slug) values(current_setting('test.store_a')::uuid,current_setting('test.user_a')::uuid,'Isolation A','test-'||current_setting('test.store_a')),(current_setting('test.store_b')::uuid,current_setting('test.user_b')::uuid,'Isolation B','test-'||current_setting('test.store_b'));
insert into public.categories(id,store_id,name,slug) values(current_setting('test.category_b')::uuid,current_setting('test.store_b')::uuid,'Private category','private-category');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_a'),'role','authenticated')::text,true);
do $$ begin
 if (select count(*) from public.stores where id in(current_setting('test.store_a')::uuid,current_setting('test.store_b')::uuid))<>1 then raise exception 'Tenant store read leaked';end if;
 if (select count(*) from public.profiles where id in(current_setting('test.user_a')::uuid,current_setting('test.user_b')::uuid))<>1 then raise exception 'Profile read leaked';end if;
 if not exists(select 1 from public.store_members where store_id=current_setting('test.store_a')::uuid and role='owner') then raise exception 'Owner bootstrap missing';end if;
 insert into public.products(id,store_id,name,slug,price) values(current_setting('test.product_a')::uuid,current_setting('test.store_a')::uuid,'Own product','own-product',12.50);
 begin
  insert into public.products(store_id,name,slug,price) values(current_setting('test.store_b')::uuid,'Intruder','intruder',1);
  raise exception 'Cross-tenant product insert was allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.products(store_id,category_id,name,slug,price) values(current_setting('test.store_a')::uuid,current_setting('test.category_b')::uuid,'Foreign category','foreign-category',1);
  raise exception 'Cross-tenant category reference was allowed';
 exception when foreign_key_violation then null;end;
 begin
  insert into public.product_variants(store_id,product_id,title,inventory_quantity) values(current_setting('test.store_a')::uuid,current_setting('test.product_a')::uuid,'Negative',-1);
  raise exception 'Negative inventory was allowed';
 exception when check_violation then null;end;
 if not exists(select 1 from public.audit_logs where store_id=current_setting('test.store_a')::uuid and entity_id=current_setting('test.product_a')::uuid) then raise exception 'Audit entry missing';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_b'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.products where id=current_setting('test.product_a')::uuid) then raise exception 'Private product leaked to tenant B';end if;
 update public.products set name='Tampered' where id=current_setting('test.product_a')::uuid;
 if found then raise exception 'Cross-tenant update was allowed';end if;
end $$;
reset role;
insert into public.store_members(store_id,user_id,role) values(current_setting('test.store_a')::uuid,current_setting('test.user_b')::uuid,'support');
set local role authenticated;
do $$ begin
 begin
  insert into public.products(store_id,name,slug,price) values(current_setting('test.store_a')::uuid,'Support write','support-write',1);
  raise exception 'Support can write catalog';
 exception when insufficient_privilege then null;end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if exists(select 1 from public.products where id=current_setting('test.product_a')::uuid) then raise exception 'Draft product leaked to anonymous visitor';end if;
end $$;
select 'PASS: owner bootstrap, profile privacy, tenant reads/writes, composite FK, nonnegative stock, support permissions, anon privacy, audit trigger' as result;
rollback;
