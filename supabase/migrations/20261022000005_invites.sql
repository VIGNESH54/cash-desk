-- Invites replace "add member by email" so the app cannot be used to find out which emails have accounts.
-- invite_member gives the same answer whether or not the email has an account; the old function is no longer executable.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 5 and 254),
  role text not null check (role in ('owner','operator')),
  invited_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);
create index invites_email_idx on public.invites (email);
create index invites_business_idx on public.invites (business_id);
create index invites_invited_by_idx on public.invites (invited_by);
alter table public.invites enable row level security; -- no policies: reachable only through the functions below

create function public.claim_invites() returns integer
language plpgsql security definer set search_path = public, auth
as $$
declare
  uid uuid := (select auth.uid());
  e text;
  n integer;
begin
  if uid is null then return 0; end if;
  select lower(email) into e from auth.users where id = uid and email_confirmed_at is not null;
  if e is null then return 0; end if;
  insert into public.members (business_id, user_id, role)
  select business_id, uid, role from public.invites where email = e
  on conflict (business_id, user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;

create function public.invite_member(p_business uuid, p_email text, p_role text default 'operator')
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  uid uuid := (select auth.uid());
  e text := lower(trim(p_email));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.members where business_id = p_business and user_id = uid and role = 'owner') then
    raise exception 'only an owner can invite people';
  end if;
  if p_role not in ('owner','operator') then raise exception 'bad role'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 254 then raise exception 'enter a valid email'; end if;
  if (select count(*) from public.invites where business_id = p_business) >= 50 then raise exception 'too many pending invites'; end if;
  insert into public.invites (business_id, email, role) values (p_business, e, p_role)
  on conflict (business_id, email) do update set role = excluded.role;
  insert into public.members (business_id, user_id, role)
  select p_business, u.id, p_role from auth.users u where lower(u.email) = e and u.email_confirmed_at is not null
  on conflict (business_id, user_id) do update set role = excluded.role;
end;
$$;
revoke all on function public.invite_member(uuid, text, text) from public, anon;
grant execute on function public.invite_member(uuid, text, text) to authenticated;
revoke execute on function public.add_member_by_email(uuid, text, text) from authenticated;
