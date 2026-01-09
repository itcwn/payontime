create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  event_type text not null,
  provider_transaction_id text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

alter table public.payment_events enable row level security;

create policy "Payment events are readable by owner"
  on public.payment_events
  for select
  using (auth.uid() = user_id);

create policy "Payment events are insertable by service role"
  on public.payment_events
  for insert
  with check (auth.role() = 'service_role');
