create table if not exists public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_session_id text null,
  provider_order_id text null,
  status text not null default 'created',
  amount numeric not null,
  currency text not null default 'PLN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_sessions_status_check check (
    status in ('created', 'pending', 'confirmed', 'failed')
  )
);

create trigger payment_sessions_set_updated_at
before update on public.payment_sessions
for each row execute function public.set_updated_at();

alter table public.payment_sessions enable row level security;

create policy "Payment sessions are user-owned"
  on public.payment_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
