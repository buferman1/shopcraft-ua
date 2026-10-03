begin;
select set_config('test.owner',gen_random_uuid()::text,true), set_config('test.other',gen_random_uuid()::text,true), set_config('test.shop',gen_random_uuid()::text,true), set_config('test.product',gen_random_uuid()::text,true), set_config('test.variant',gen_random_uuid()::text,true), set_config('test.token',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.owner')::uuid,current_setting('test.owner')||'@example.invalid'),(current_setting('test.other')::uuid,current_setting('test.other')||'@example.invalid');
insert into public.stores(id,owner_id,name,slug,status) values(current_setting('test.shop')::uuid,current_setting('test.owner')::uuid,'Commerce QA','qa-'||current_setting('test.shop'),'active');
insert into public.storefronts(store_id,slug,name,currency,config,revision) values(current_setting('test.shop')::uuid,'qa-'||current_setting('test.shop'),'Commerce QA','UAH','{"version":1,"theme":"minimal"}',1);
insert into public.store_settings(store_id,orders_enabled,shipping_fee) values(current_setting('test.shop')::uuid,true,50);
insert into public.products(id,store_id,name,slug,price,status) values(current_setting('test.product')::uuid,current_setting('test.shop')::uuid,'QA Shirt','qa-shirt',100,'active');
insert into public.product_variants(id,store_id,product_id,title,price,inventory_quantity) values(current_setting('test.variant')::uuid,current_setting('test.shop')::uuid,current_setting('test.product')::uuid,'M',120,5);
select set_config('test.payload',jsonb_build_object('token',current_setting('test.token'),'name','QA Buyer','phone','380671111111','email','','method','delivery','address','QA address','consent',true,'items',jsonb_build_array(jsonb_build_object('variantId',current_setting('test.variant'),'quantity',2,'price',1)))::text,true);
set local role anon;
select set_config('request.jwt.claims','{}',true);
select set_config('test.result',public.checkout_order('qa-'||current_setting('test.shop'),current_setting('test.payload')::jsonb)::text,true);
do $$ declare result jsonb; begin
  result := current_setting('test.result')::jsonb;
  if (result->>'total')::numeric <> 290 then raise exception 'Untrusted price or shipping used'; end if;
  if public.checkout_order('qa-'||current_setting('test.shop'),current_setting('test.payload')::jsonb)->>'id' <> result->>'id' then raise exception 'Idempotency failed'; end if;
  if exists(select 1 from public.orders where store_id=current_setting('test.shop')::uuid) then raise exception 'Guest order privacy failed'; end if;
  if exists(select 1 from public.customers where store_id=current_setting('test.shop')::uuid) then raise exception 'Guest customer privacy failed'; end if;
  begin
    perform public.checkout_order('qa-'||current_setting('test.shop'),jsonb_set(current_setting('test.payload')::jsonb,'{name}','"Changed buyer"'));
    raise exception 'Modified retry accepted';
  exception when raise_exception then if sqlerrm <> 'SC_RETRY' then raise; end if; end;
  begin
    perform public.checkout_order('qa-'||current_setting('test.shop'),jsonb_set(jsonb_set(current_setting('test.payload')::jsonb,'{token}',to_jsonb(gen_random_uuid()::text)),'{items,0,quantity}','20'));
    raise exception 'Oversell accepted';
  exception when raise_exception then if sqlerrm <> 'SC_STOCK' then raise; end if; end;
  begin
    perform public.checkout_order('qa-'||current_setting('test.shop'),jsonb_set(jsonb_set(current_setting('test.payload')::jsonb,'{token}',to_jsonb(gen_random_uuid()::text)),'{consent}','false'));
    raise exception 'Missing consent accepted';
  exception when raise_exception then if sqlerrm <> 'SC_INVALID' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.orders where store_id=current_setting('test.shop')::uuid) <> 1 then raise exception 'Duplicate order'; end if;
  if (select inventory_quantity from public.product_variants where id=current_setting('test.variant')::uuid) <> 5 then raise exception 'Guest request reserved stock'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.orders where store_id=current_setting('test.shop')::uuid) then raise exception 'Cross-tenant order leaked'; end if;
  begin
    perform public.change_order_status(current_setting('test.shop')::uuid,((current_setting('test.result')::jsonb)->>'id')::uuid,'confirmed');
    raise exception 'Cross-tenant confirmation allowed';
  exception when raise_exception then if sqlerrm <> 'SC_DENIED' then raise; end if; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
select public.change_order_status(current_setting('test.shop')::uuid,((current_setting('test.result')::jsonb)->>'id')::uuid,'confirmed');
select public.change_order_status(current_setting('test.shop')::uuid,((current_setting('test.result')::jsonb)->>'id')::uuid,'confirmed');
do $$ begin
  if (select inventory_quantity from public.product_variants where id=current_setting('test.variant')::uuid) <> 3 then raise exception 'Confirmation stock/idempotency failed'; end if;
  begin
    update public.orders set status='cancelled' where store_id=current_setting('test.shop')::uuid;
    raise exception 'Direct order mutation allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.product_variants where id=current_setting('test.variant')::uuid;
    raise exception 'Reserved variant deleted';
  exception when raise_exception then if sqlerrm <> 'Variant belongs to reserved order' then raise; end if; end;
end $$;
select public.change_order_status(current_setting('test.shop')::uuid,((current_setting('test.result')::jsonb)->>'id')::uuid,'cancelled');
select public.change_order_status(current_setting('test.shop')::uuid,((current_setting('test.result')::jsonb)->>'id')::uuid,'cancelled');
do $$ begin
  if (select inventory_quantity from public.product_variants where id=current_setting('test.variant')::uuid) <> 5 then raise exception 'Cancellation restored more than once'; end if;
  begin
    perform public.change_order_status(current_setting('test.shop')::uuid,((current_setting('test.result')::jsonb)->>'id')::uuid,'confirmed');
    raise exception 'Cancelled order reopened';
  exception when raise_exception then if sqlerrm <> 'SC_TRANSITION' then raise; end if; end;
end $$;
reset role;
insert into public.store_members(store_id,user_id,role) values(current_setting('test.shop')::uuid,current_setting('test.other')::uuid,'support');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
do $$ begin
  if (select count(*) from public.orders where store_id=current_setting('test.shop')::uuid) <> 1 then raise exception 'Support cannot read orders'; end if;
  begin
    perform public.change_order_status(current_setting('test.shop')::uuid,((current_setting('test.result')::jsonb)->>'id')::uuid,'confirmed');
    raise exception 'Support can manage stock';
  exception when raise_exception then if sqlerrm <> 'SC_DENIED' then raise; end if; end;
end $$;
select 'PASS checkout: trusted prices, delivery, idempotency, consent, stock checks, guest privacy, tenant isolation, confirmation/cancellation atomic stock, role permissions' as result;
rollback;
