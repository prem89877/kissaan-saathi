-- =====================================================================
-- 25_email_notification_preference.sql
--
-- Purpose: Part E — "respect... user preferences" for notifications.
-- One simple opt-out: email notifications on/off per person (in-app and
-- push are unaffected by this — they're expected/low-friction; email is
-- the one channel people most often want to turn off).
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run.
-- =====================================================================

alter table public.profiles add column if not exists email_notifications_enabled boolean not null default true;

-- A dedicated RPC rather than assuming the client can UPDATE its own
-- profiles row directly — this project's other self-service actions
-- (withdrawals, OTP, deposits) all go through a narrow SECURITY DEFINER
-- function rather than relying on a table-wide RLS UPDATE policy, so this
-- follows the same pattern instead of guessing profiles' existing policy.
create or replace function public.set_email_notifications_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;
  update public.profiles set email_notifications_enabled = p_enabled where id = auth.uid();
end;
$$;

grant execute on function public.set_email_notifications_enabled(boolean) to authenticated;
