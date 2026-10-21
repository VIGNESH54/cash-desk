-- Hardening from the first audit. Additive only: owner-only rules are RESTRICTIVE policies that AND with the existing ones.
create index if not exists events_customer_fk_idx on public.events (customer_id, business_id);
create index if not exists invoices_customer_fk_idx on public.invoices (customer_id, business_id);
create index if not exists payments_invoice_fk_idx on public.payments (invoice_id, business_id);
create index if not exists promises_invoice_fk_idx on public.promises (invoice_id, business_id);
create index if not exists reminders_customer_fk_idx on public.reminders (customer_id, business_id);
create index if not exists client_errors_user_idx on public.client_errors (user_id);
create index if not exists client_errors_business_idx on public.client_errors (business_id);

create function public.is_owner(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.business_id = bid and m.user_id = (select auth.uid()) and m.role = 'owner')
$$;
revoke all on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;

create policy businesses_update_owner_only on public.businesses as restrictive for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy customers_delete_owner_only on public.customers as restrictive for delete to authenticated using (public.is_owner(business_id));
create policy invoices_delete_owner_only on public.invoices as restrictive for delete to authenticated using (public.is_owner(business_id));
create policy payments_delete_owner_only on public.payments as restrictive for delete to authenticated using (public.is_owner(business_id));
create policy promises_delete_owner_only on public.promises as restrictive for delete to authenticated using (public.is_owner(business_id));
create policy reminders_delete_owner_only on public.reminders as restrictive for delete to authenticated using (public.is_owner(business_id));
create policy events_delete_owner_only on public.events as restrictive for delete to authenticated using (public.is_owner(business_id));
