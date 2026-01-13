alter table public.payments
  add column if not exists is_fixed boolean not null default false,
  add column if not exists is_automatic boolean not null default false;
