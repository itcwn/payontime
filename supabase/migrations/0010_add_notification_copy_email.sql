alter table public.user_settings
add column if not exists notification_copy_email text null;
