-- Compare UUID identity, not spelling/case, to reject duplicate cart lines via direct RPC.
do $$
declare original text; normalized text;
begin
  original := pg_get_functiondef('private.checkout_order(text,jsonb)'::regprocedure);
  normalized := replace(original,'count(distinct x->>''variantId'')','count(distinct (x->>''variantId'')::uuid)');
  if normalized = original then raise exception 'Checkout normalization target not found'; end if;
  execute normalized;
end $$;
