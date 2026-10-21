alter table public.businesses add column pay_instructions text check (pay_instructions is null or char_length(pay_instructions) <= 200);
alter table public.reminders add column invoice_steps jsonb not null default '{}'::jsonb;
