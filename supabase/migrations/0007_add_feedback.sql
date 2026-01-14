create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_type text not null,
  title text not null,
  description text not null,
  created_at timestamptz not null default now(),
  constraint feedback_type_check check (feedback_type in ('bug', 'idea'))
);

alter table public.feedback enable row level security;

create policy "Feedback insertable by owner"
  on public.feedback
  for insert
  with check (auth.uid() = user_id);
