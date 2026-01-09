alter table public.user_settings
  add column if not exists plan_tier text not null default 'free',
  add column if not exists premium_expires_at timestamptz null;

alter table public.user_settings
  add constraint user_settings_plan_tier_check
  check (plan_tier in ('free', 'premium'));
