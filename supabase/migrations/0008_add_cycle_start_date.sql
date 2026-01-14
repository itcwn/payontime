alter table public.payments
  add column if not exists cycle_start_date date null;

update public.payments
  set cycle_start_date = coalesce(cycle_start_date, due_date, created_at::date)
  where schedule_mode <> 'one_time';

alter table public.payments
  drop constraint if exists payments_cycle_start_date_check;

alter table public.payments
  add constraint payments_cycle_start_date_check
    check (
      (schedule_mode = 'one_time' and cycle_start_date is null)
      or (schedule_mode <> 'one_time' and cycle_start_date is not null)
    );
