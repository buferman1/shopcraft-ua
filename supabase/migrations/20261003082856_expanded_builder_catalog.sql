-- Expand the accepted design vocabulary without changing tenant policies.
alter table public.store_designs drop constraint store_designs_config_check;
alter table public.store_designs add constraint store_designs_config_check check (
jsonb_typeof(config) = 'object' and config->>'version' = '1'
and config->>'theme' in ('minimal','street','boutique','linen','atelier','sport','sneaker','kids','accessory','denim')
and octet_length(config::text) <= 65536);
alter table public.storefronts drop constraint storefronts_config_check;
alter table public.storefronts add constraint storefronts_config_check check (
jsonb_typeof(config) = 'object' and config->>'version' = '1'
and config->>'theme' in ('minimal','street','boutique','linen','atelier','sport','sneaker','kids','accessory','denim')
and octet_length(config::text) <= 65536);
alter table public.products add column on_sale boolean generated always as (coalesce(compare_at_price > price, false)) stored;
create index products_catalog_price_idx on public.products(store_id,status,price,id);
create index products_catalog_newest_idx on public.products(store_id,status,created_at desc,id);
create index variants_catalog_options_idx on public.product_variants(store_id,product_id,(options->>'size'),(options->>'color'),inventory_quantity);
