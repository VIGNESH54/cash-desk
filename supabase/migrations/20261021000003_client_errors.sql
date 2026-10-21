-- Lightweight error monitoring: the browser app reports unexpected errors here.
-- Signed-in users can insert their own rows only. Nobody can read them from the app; read in the Supabase dashboard.
create table public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 4000),
  url text check (char_length(url) <= 500),
  user_agent text check (char_length(user_agent) <= 300),
  app_version text check (char_length(app_version) <= 40),
  created_at timestamptz not null default now()
);
create index client_errors_created_idx on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;

create policy client_errors_insert_own on public.client_errors
  for insert to authenticated
  with check (user_id = auth.uid() and (business_id is null or public.is_member(business_id)));

-- Stop a runaway client from flooding the table: at most 100 reports per user per hour.
create function public.client_errors_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.client_errors where user_id = new.user_id and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'too many error reports';
  end if;
  return new;
end $$;
create trigger client_errors_throttle before insert on public.client_errors
  for each row execute function public.client_errors_throttle();
revoke all on function public.client_errors_throttle() from public, anon, authenticated;
