-- =====================================================================
-- 20_web_push.sql
--
-- Purpose: Part E — "Web/PWA push notifications... through a valid
-- service worker and subscription flow." Today public/sw.js only handles
-- offline caching; there is no push subscription storage and nothing
-- sends a push. This migration adds the DB side; see the accompanying
-- app changes (sw.js push handler, PushPermissionPrompt.tsx,
-- app/api/push/send-for-notification/route.ts) for the rest.
--
-- Design: every notification already funnels through ONE place —
-- create_notification() inserting into the `notifications` table
-- (11_notifications.sql). This migration adds an AFTER INSERT trigger on
-- that table which asks Postgres (via pg_net) to call your deployed
-- app's /api/push/send-for-notification, which then sends the actual
-- push via the `web-push` npm library using VAPID keys. This means every
-- existing notification type automatically gets push for free — no need
-- to touch the 800+ lines of existing notification trigger logic.
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
--
-- MANUAL SETUP REQUIRED AFTER RUNNING (this cannot work without these):
--   1. pg_net extension must be enabled on your project (Database >
--      Extensions). If it's not available on your plan, the trigger
--      below will error when it fires — push just won't happen; nothing
--      else breaks.
--   2. Generate a VAPID key pair once, locally: `npx web-push
--      generate-vapid-keys`. Set as Vercel env vars:
--        NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
--        VAPID_SUBJECT=mailto:your-support-email@example.com
--   3. Generate a random secret string (e.g. `openssl rand -hex 32`) and
--      set it as the Vercel env var PUSH_WEBHOOK_SECRET.
--   4. Run the UPDATE statements at the bottom of this file with your
--      actual deployed URL and the SAME secret from step 3.
-- =====================================================================

create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- 1. Where each browser's push subscription is stored. A user can have
--    several (phone + laptop, etc.), hence keyed by endpoint, not user.
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. Small config table so the webhook URL/secret can be set (and later
--    changed, e.g. after a domain change) without editing this function
--    or rerunning a migration.
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  key text primary key,
  value text
);

insert into public.app_config (key, value) values
  ('push_webhook_url', 'https://kissaan-saathi.vercel.app/api/push/send-for-notification'),
  ('push_webhook_secret', 'REPLACE_ME')
on conflict (key) do nothing;

-- No RLS policy at all on app_config for authenticated/anon — only the
-- table owner (used by the trigger below, and by you via the SQL editor)
-- can read or write it. It holds a shared secret, not per-user data.
alter table public.app_config enable row level security;

-- ---------------------------------------------------------------------
-- 3. Fire-and-forget webhook on every new notification row.
-- ---------------------------------------------------------------------
create or replace function public.notify_push_on_new_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from public.app_config where key = 'push_webhook_url';
  select value into v_secret from public.app_config where key = 'push_webhook_secret';

  if v_url is null or v_secret is null or v_secret = 'REPLACE_ME' then
    return new; -- not configured yet — skip silently, don't block the notification itself
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('notification_id', new.id)
  );

  return new;
exception when others then
  -- A push-delivery hiccup must never roll back the notification insert
  -- itself (which is what every order/payment/dispute flow relies on).
  return new;
end;
$$;

drop trigger if exists trg_notify_push_on_new_notification on public.notifications;
create trigger trg_notify_push_on_new_notification
  after insert on public.notifications
  for each row
  execute function public.notify_push_on_new_notification();

-- ---------------------------------------------------------------------
-- Run these two with YOUR real values once you've completed the manual
-- setup steps above (safe to run repeatedly):
--
-- update public.app_config set value = 'https://your-actual-domain.com/api/push/send-for-notification' where key = 'push_webhook_url';
-- update public.app_config set value = 'the-same-random-secret-you-put-in-vercel' where key = 'push_webhook_secret';
-- ---------------------------------------------------------------------
