-- Cash Desk: schema, tenant isolation (RLS) and helper functions.
-- Every row belongs to a business. A user sees a business only through `members`.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_name text,
  owner_phone text,
  udyam_status text not null default 'unknown'
    check (udyam_status in ('registered_micro','registered_small','not_registered','unknown')),
  bank_rate numeric(5,2) not null default 5.75 check (bank_rate >= 0 and bank_rate <= 30),
  brief_hour int not null default 21 check (brief_hour between 0 and 23),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','operator')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index members_user_idx on public.members(user_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  contact_person text,
  phone text,
  accounts_phone text,
  kind text not null default 'business' check (kind in ('business','walk_in')),
  tone text not null default 'formal' check (tone in ('friendly','formal')),
  apply_legal boolean not null default false,
  language text not null default 'en' check (language in ('en','hinglish')),
  opted_out boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index customers_name_uq on public.customers(business_id, lower(name));

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null,
  number text not null check (char_length(number) between 1 and 60),
  issue_date date not null,
  accepted_on date,
  agreed_days int not null default 30 check (agreed_days between 0 and 365),
  written_agreement boolean not null default true,
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers(id, business_id) on delete cascade,
  unique (id, business_id),
  unique (business_id, customer_id, number)
);
create index invoices_business_idx on public.invoices(business_id);
create index invoices_customer_idx on public.invoices(customer_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  invoice_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null,
  method text,
  note text,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, business_id) references public.invoices(id, business_id) on delete cascade
);
create index payments_business_idx on public.payments(business_id);
create index payments_invoice_idx on public.payments(invoice_id);

create table public.promises (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  invoice_id uuid not null,
  promised_on date not null,
  status text not null default 'open' check (status in ('open','kept','broken')),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (invoice_id, business_id) references public.invoices(id, business_id) on delete cascade
);
create index promises_business_idx on public.promises(business_id);
create index promises_invoice_idx on public.promises(invoice_id);

-- History of reminders that were actually sent or deliberately skipped.
-- The day's queue is derived from invoices + this history, so it never goes stale.
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null,
  invoice_ids uuid[] not null,
  step text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','sms','call','manual')),
  planned_for date not null,
  body text not null,
  status text not null check (status in ('sent','skipped')),
  sent_at timestamptz not null default now(),
  sent_by uuid default auth.uid(),
  foreign key (customer_id, business_id) references public.customers(id, business_id) on delete cascade
);
create index reminders_business_idx on public.reminders(business_id, planned_for);
create index reminders_customer_idx on public.reminders(customer_id);

-- Timeline entries: customer replies, calls, notes.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null,
  invoice_id uuid,
  kind text not null check (kind in ('reply','call','note')),
  body text not null check (char_length(body) between 1 and 2000),
  at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  foreign key (customer_id, business_id) references public.customers(id, business_id) on delete cascade
);
create index events_business_idx on public.events(business_id, at desc);
create index events_customer_idx on public.events(customer_id);

-- ---------------------------------------------------------------- access control

create or replace function public.is_member(bid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.business_id = bid and m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.promises enable row level security;
alter table public.reminders enable row level security;
alter table public.events enable row level security;

create policy businesses_select on public.businesses for select to authenticated
  using (public.is_member(id));
create policy businesses_update on public.businesses for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

create policy members_select on public.members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_member(business_id));

do $$
declare t text;
begin
  foreach t in array array['customers','invoices','payments','promises','reminders','events'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(business_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(business_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member(business_id)) with check (public.is_member(business_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member(business_id))', t || '_delete', t);
  end loop;
end $$;

-- Creating a business and its first membership must happen together.
create or replace function public.create_business(
  p_name text,
  p_owner_name text default null,
  p_owner_phone text default null,
  p_udyam text default 'unknown'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  bid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.businesses(name, owner_name, owner_phone, udyam_status, created_by)
  values (p_name, p_owner_name, p_owner_phone, p_udyam, uid)
  returning id into bid;
  insert into public.members(business_id, user_id, role) values (bid, uid, 'owner');
  return bid;
end;
$$;
revoke all on function public.create_business(text, text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text, text) to authenticated;

-- An owner can add another signed-up user (for example the shop owner you set this up for).
create or replace function public.add_member_by_email(p_business uuid, p_email text, p_role text default 'owner')
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  uid uuid := (select auth.uid());
  target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.members where business_id = p_business and user_id = uid and role = 'owner') then
    raise exception 'only an owner can add members';
  end if;
  if p_role not in ('owner','operator') then raise exception 'bad role'; end if;
  select id into target from auth.users where lower(email) = lower(p_email);
  if target is null then raise exception 'no account with that email; ask them to sign up first'; end if;
  insert into public.members(business_id, user_id, role) values (p_business, target, p_role)
  on conflict (business_id, user_id) do update set role = excluded.role;
end;
$$;
revoke all on function public.add_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.add_member_by_email(uuid, text, text) to authenticated;
