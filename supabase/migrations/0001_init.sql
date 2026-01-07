create extension if not exists "pgcrypto";

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_type text not null,
  name text null,
  amount numeric null,
  currency text not null default 'PLN',
  provider_address text not null,
  schedule_mode text not null,
  due_date date null,
  day_of_month int null,
  is_last_day boolean not null default false,
  remind_offsets int[] not null default '{-3,0}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_payment_type_check check (
    payment_type in (
      'czynsz',
      'prąd',
      'gaz',
      'woda',
      'ZUS',
      'podatek od nieruchomości',
      'ubezpieczenie od nieruchomości',
      'OC/AC',
      'abonament RTV'
    )
  ),
  constraint payments_schedule_mode_check check (schedule_mode in ('one_time', 'monthly')),
  constraint payments_one_time_check check (
    (schedule_mode = 'one_time' and due_date is not null and day_of_month is null and is_last_day = false)
    or (schedule_mode = 'monthly')
  ),
  constraint payments_monthly_check check (
    (schedule_mode = 'monthly' and ((is_last_day = true and day_of_month is null) or (is_last_day = false and day_of_month between 1 and 31)))
    or (schedule_mode = 'one_time')
  )
);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  due_date date not null,
  offset_days int not null,
  channel text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz null,
  status text not null,
  error text null,
  created_at timestamptz not null default now(),
  constraint notification_channel_check check (channel in ('email', 'push')),
  constraint notification_status_check check (status in ('queued', 'sent', 'failed'))
);

create unique index if not exists notification_log_unique
  on public.notification_log (user_id, payment_id, due_date, offset_days, channel);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Europe/Warsaw',
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  push_subscription jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
alter table public.notification_log enable row level security;
alter table public.user_settings enable row level security;

create policy "Payments are user-owned"
  on public.payments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Notification logs readable by owner"
  on public.notification_log
  for select
  using (auth.uid() = user_id);

create policy "Notification logs insertable by service role"
  on public.notification_log
  for insert
  with check (auth.role() = 'service_role');

create policy "User settings are user-owned"
  on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
