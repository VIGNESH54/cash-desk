-- Hardening from the first audit.

-- 1. Cover composite foreign keys with indexes.
create index if not exists events_customer_fk_idx on public.events (customer_id, business_id);
create index if not exists invoices_customer_fk_idx on public.invoices (customer_id, business_id);
create index if not exists payments_invoice_fk_idx on public.payments (invoice_id, business_id);
create index if not exists promises_invoice_fk_idx on public.promises (invoice_id, business_id);
create index if not exists reminders_customer_fk_idx on public.reminders (customer_id, business_id);
create index if not exists client_errors_user_idx on public.client_errors (user_id);
create index if not exists client_errors_business_idx on public.client_errors (business_id);

-- 2. Evaluate auth.uid() once per statement, not once per row.
drop policy client_errors_insert_own on public.client_errors;
create policy client_errors_insert_own on public.client_errors
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (business_id is null or public.is_member(business_id)));

-- 3. Only owners can change business settings or delete records. Operators can read and add.
create function public.is_owner(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.business_id = bid and m.user_id = (select auth.uid()) and m.role = 'owner')
$$;
revoke all on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;

drop policy businesses_update on public.businesses;
create policy businesses_update on public.businesses for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

do $$
declare t text;
begin
  foreach t in array array['customers','invoices','payments','promises','reminders','events'] loop
    execute format('drop policy %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_owner(business_id))', t || '_delete', t);
  end loop;
end $$;
