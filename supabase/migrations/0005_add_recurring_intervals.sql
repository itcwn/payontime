alter table public.payments
  add column if not exists interval_unit text null,
  add column if not exists interval_months int null,
  add column if not exists interval_weeks int null;

alter table public.payments
  drop constraint if exists payments_schedule_mode_check,
  drop constraint if exists payments_one_time_check,
  drop constraint if exists payments_monthly_check;

alter table public.payments
  add constraint payments_schedule_mode_check
    check (schedule_mode in ('one_time', 'monthly', 'recurring')),
  add constraint payments_one_time_check
    check (
      (schedule_mode = 'one_time' and due_date is not null and day_of_month is null)
      or schedule_mode <> 'one_time'
    ),
  add constraint payments_recurring_check
    check (
      (schedule_mode <> 'one_time' and due_date is null)
      or schedule_mode = 'one_time'
    ),
  add constraint payments_day_of_month_check
    check (
      (schedule_mode <> 'one_time' and ((is_last_day = true and day_of_month is null) or (is_last_day = false and day_of_month between 1 and 31)))
      or schedule_mode = 'one_time'
    ),
  add constraint payments_interval_unit_check
    check (interval_unit is null or interval_unit in ('weeks', 'months')),
  add constraint payments_interval_value_check
    check (
      (interval_unit = 'weeks' and interval_weeks is not null and interval_weeks > 0)
      or (interval_unit = 'months' and interval_months is not null and interval_months > 0)
      or interval_unit is null
    );
