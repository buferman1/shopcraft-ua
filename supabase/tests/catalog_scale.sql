begin;
select set_config('test.owner',gen_random_uuid()::text,true), set_config('test.shop',gen_random_uuid()::text,true), set_config('test.hidden',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.owner')::uuid,current_setting('test.owner')||'@example.invalid');
insert into public.stores(id,owner_id,name,slug,status) values(current_setting('test.shop')::uuid,current_setting('test.owner')::uuid,'Scale QA','qa-'||current_setting('test.shop'),'active'),(current_setting('test.hidden')::uuid,current_setting('test.owner')::uuid,'Private QA','qa-'||current_setting('test.hidden'),'draft');
insert into public.storefronts(store_id,slug,name,currency,config,revision) values(current_setting('test.shop')::uuid,'qa-'||current_setting('test.shop'),'Scale QA','UAH','{"version":1,"theme":"atelier"}',1);
insert into public.products(store_id,name,slug,price,compare_at_price,status)
select current_setting('test.shop')::uuid,'Product '||n,'product-'||n,n,case when n % 2 = 0 then n+10 else n end,'active' from generate_series(1,525) n;
insert into public.products(store_id,name,slug,price,status) values(current_setting('test.hidden')::uuid,'Hidden','hidden',1,'active');
insert into public.product_variants(store_id,product_id,title,inventory_quantity,options) select store_id,id,'M black',3,'{"size":"M","color":"black"}' from public.products where store_id=current_setting('test.shop')::uuid;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if (select count(*) from public.products where store_id=current_setting('test.shop')::uuid) <> 525 then raise exception '525 product visibility failed'; end if;
 if (select count(*) from public.products where store_id=current_setting('test.shop')::uuid and on_sale) <> 262 then raise exception 'Discount comparison failed'; end if;
 if (select count(*) from (select id from public.products where store_id=current_setting('test.shop')::uuid order by price,id offset 504 limit 24) p) <> 21 then raise exception 'Last page truncated'; end if;
 if exists(select 1 from public.products where store_id=current_setting('test.hidden')::uuid) then raise exception 'Private store exposed'; end if;
 if (select count(*) from public.products p where p.store_id=current_setting('test.shop')::uuid and p.price between 500 and 525 and exists(select 1 from public.product_variants v where v.product_id=p.id and v.store_id=p.store_id and v.options->>'size'='M' and v.options->>'color'='black' and v.inventory_quantity>0)) <> 26 then raise exception 'Combined filters failed'; end if;
end $$;
rollback;
