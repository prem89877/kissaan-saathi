-- =====================================================================
-- 17_delivery_otp.sql
--
-- Purpose: implement Part D's OTP requirement — "OTP is required at
-- farmer pickup and buyer delivery... verified server-side... Delivery
-- Partner can submit OTP for the relevant assigned order."
--
-- Today, a delivery partner can tap "Mark delivered" with zero
-- verification that they ever visited the farmer or the buyer. This
-- migration closes that gap without touching any existing table,
-- trigger, or status value:
--
--   - Adds ONE nullable column: orders.pickup_confirmed_at (additive).
--   - Adds a new table: order_otps (new table, not touching existing ones).
--   - Adds a new trigger that GENERATES both OTPs the moment an order
--     already transitions to 'out_for_delivery' for delivery_mode =
--     'delivery' — it does not change what triggers that transition,
--     only reacts to it (fires alongside, not instead of, the existing
--     enforce_order_transition / notification triggers).
--   - Adds two SECURITY DEFINER RPCs — verify_pickup_otp and
--     verify_delivery_otp — which are now the ONLY way an OTP is checked
--     or an order is moved from out_for_delivery -> delivered by a
--     delivery partner. The app's "Mark delivered" button must be
--     replaced with a call to verify_delivery_otp (see accompanying
--     component changes) — a raw `.update({status:'delivered'})` from
--     the delivery partner should no longer be used for delivery-mode
--     orders.
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
--
-- PRE-REQUISITE CHECK BEFORE RUNNING (please verify, since migrations
-- 1-10 aren't visible to me):
--   - public.is_admin() exists (used by 13_order_status_history_delivery_partner.sql,
--     so it should already be present).
--   - orders has columns: id, status, delivery_mode, delivery_partner_id,
--     farmer_id, buyer_id (all referenced by existing code/migrations).
--   - pgcrypto extension can be enabled (used only for gen_random_uuid();
--     Supabase projects normally already have this).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. New column: when the delivery partner actually confirmed pickup
--    from the farmer (separate from order.status, which stays
--    'out_for_delivery' for the whole "ready -> picked up -> delivering"
--    span in the existing state machine).
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists pickup_confirmed_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. OTP storage.
--
-- Codes are stored in PLAIN TEXT, not hashed. This is a deliberate
-- choice, not an oversight: the business requirement is that the
-- authorized farmer/buyer can open their order screen and read the code
-- (possibly more than once), and a one-way hash can't be displayed back.
-- The protection here is strict row-level security (below): a farmer can
-- only ever read the 'pickup' row of their own order, a buyer only the
-- 'delivery' row of their own order, the delivery partner can never
-- SELECT a row at all (only submit a guess through the verify_* RPCs),
-- and everyone else is denied by default (RLS with no matching policy
-- denies access). Codes also expire and are rate-limited on attempts.
-- ---------------------------------------------------------------------
create table if not exists public.order_otps (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  purpose text not null check (purpose in ('pickup', 'delivery')),
  code text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, purpose)
);

alter table public.order_otps enable row level security;

drop policy if exists order_otps_select_farmer on public.order_otps;
create policy order_otps_select_farmer on public.order_otps
  for select to authenticated
  using (
    purpose = 'pickup'
    and exists (select 1 from public.orders o where o.id = order_otps.order_id and o.farmer_id = auth.uid())
  );

drop policy if exists order_otps_select_buyer on public.order_otps;
create policy order_otps_select_buyer on public.order_otps
  for select to authenticated
  using (
    purpose = 'delivery'
    and exists (select 1 from public.orders o where o.id = order_otps.order_id and o.buyer_id = auth.uid())
  );

drop policy if exists order_otps_select_admin on public.order_otps;
create policy order_otps_select_admin on public.order_otps
  for select to authenticated
  using (is_admin());

-- Intentionally NO insert/update/delete policy for any client role: rows
-- are only ever written by the SECURITY DEFINER functions below, which
-- run as the function owner and so are not subject to RLS. The delivery
-- partner has no policy at all here, so they can never SELECT a code —
-- only call verify_pickup_otp / verify_delivery_otp with their own guess.

-- ---------------------------------------------------------------------
-- 3. Generate both OTPs the moment an order becomes ready for a delivery
--    partner to pick up. Six digits, zero-padded, expires in 48 hours
--    (generous window covering pickup delay + transit; adjust the
--    interval below if you want it tighter).
-- ---------------------------------------------------------------------
create or replace function public.generate_order_delivery_otps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pickup_code text := lpad(floor(random() * 1000000)::text, 6, '0');
  v_delivery_code text := lpad(floor(random() * 1000000)::text, 6, '0');
begin
  if new.status = 'out_for_delivery'
     and (old.status is distinct from 'out_for_delivery')
     and new.delivery_mode = 'delivery' then

    insert into public.order_otps (order_id, purpose, code, expires_at)
    values (new.id, 'pickup', v_pickup_code, now() + interval '48 hours')
    on conflict (order_id, purpose) do update
      set code = excluded.code,
          expires_at = excluded.expires_at,
          attempts = 0,
          verified_at = null;

    insert into public.order_otps (order_id, purpose, code, expires_at)
    values (new.id, 'delivery', v_delivery_code, now() + interval '48 hours')
    on conflict (order_id, purpose) do update
      set code = excluded.code,
          expires_at = excluded.expires_at,
          attempts = 0,
          verified_at = null;

    -- Best-effort notifications (Part E: "Pickup OTP and delivery OTP
    -- availability"). Wrapped so a notification hiccup never blocks the
    -- order transition itself.
    begin
      perform create_notification(
        new.farmer_id, 'pickup_otp_ready', 'Pickup OTP ready',
        'Share this code with the delivery partner when they arrive to collect the order.',
        '/farmer/orders/' || new.id, '{}'::jsonb, p_order => new.id
      );
      perform create_notification(
        new.buyer_id, 'delivery_otp_ready', 'Delivery OTP ready',
        'Share this code with the delivery partner when your order arrives.',
        '/buyer/orders/' || new.id, '{}'::jsonb, p_order => new.id
      );
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_generate_order_delivery_otps on public.orders;
create trigger trg_generate_order_delivery_otps
  after update on public.orders
  for each row
  execute function public.generate_order_delivery_otps();

-- ---------------------------------------------------------------------
-- 4. Verification RPCs. Both are SECURITY DEFINER so they can read/write
--    order_otps despite the client having no direct policy for it, but
--    each starts by checking auth.uid() itself, so this is not an open
--    bypass — a delivery partner can only ever act on an order they are
--    assigned to.
-- ---------------------------------------------------------------------
create or replace function public.verify_pickup_otp(p_order_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_otp record;
begin
  select id, status, delivery_partner_id, delivery_mode, pickup_confirmed_at, farmer_id, buyer_id
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0001';
  end if;
  if v_order.delivery_partner_id is null or v_order.delivery_partner_id <> auth.uid() then
    raise exception 'This order is not assigned to you' using errcode = 'P0001';
  end if;
  if v_order.delivery_mode <> 'delivery' then
    raise exception 'This order does not use delivery-partner pickup' using errcode = 'P0001';
  end if;
  if v_order.pickup_confirmed_at is not null then
    raise exception 'Pickup was already confirmed for this order' using errcode = 'P0001';
  end if;
  if v_order.status <> 'out_for_delivery' then
    raise exception 'This order is not ready for pickup confirmation' using errcode = 'P0001';
  end if;

  select * into v_otp from public.order_otps
   where order_id = p_order_id and purpose = 'pickup'
   for update;

  if v_otp.id is null then
    raise exception 'No pickup code was generated for this order' using errcode = 'P0001';
  end if;
  if v_otp.verified_at is not null then
    raise exception 'Pickup was already confirmed for this order' using errcode = 'P0001';
  end if;
  if now() > v_otp.expires_at then
    raise exception 'This pickup code has expired' using errcode = 'P0001';
  end if;
  if v_otp.attempts >= v_otp.max_attempts then
    raise exception 'Too many incorrect attempts — ask Admin for help' using errcode = 'P0001';
  end if;

  if v_otp.code <> trim(p_code) then
    update public.order_otps set attempts = attempts + 1 where id = v_otp.id;
    raise exception 'Incorrect pickup code' using errcode = 'P0001';
  end if;

  update public.order_otps set verified_at = now() where id = v_otp.id;
  update public.orders set pickup_confirmed_at = now() where id = p_order_id;

  begin
    perform create_notification(
      v_order.buyer_id, 'order_picked_up', 'Order picked up',
      'The delivery partner has picked up your order and is on the way.',
      '/buyer/orders/' || p_order_id, '{}'::jsonb, p_order => p_order_id
    );
    perform create_notification(
      v_order.farmer_id, 'order_picked_up', 'Pickup confirmed',
      'The delivery partner confirmed pickup of this order.',
      '/farmer/orders/' || p_order_id, '{}'::jsonb, p_order => p_order_id
    );
  exception when others then
    null;
  end;
end;
$$;

create or replace function public.verify_delivery_otp(p_order_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_otp record;
begin
  select id, status, delivery_partner_id, delivery_mode, pickup_confirmed_at, farmer_id, buyer_id
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0001';
  end if;
  if v_order.delivery_partner_id is null or v_order.delivery_partner_id <> auth.uid() then
    raise exception 'This order is not assigned to you' using errcode = 'P0001';
  end if;
  if v_order.delivery_mode <> 'delivery' then
    raise exception 'This order does not use delivery-partner delivery' using errcode = 'P0001';
  end if;
  if v_order.pickup_confirmed_at is null then
    raise exception 'Confirm pickup from the farmer before confirming delivery' using errcode = 'P0001';
  end if;
  if v_order.status <> 'out_for_delivery' then
    raise exception 'This order is not out for delivery' using errcode = 'P0001';
  end if;

  select * into v_otp from public.order_otps
   where order_id = p_order_id and purpose = 'delivery'
   for update;

  if v_otp.id is null then
    raise exception 'No delivery code was generated for this order' using errcode = 'P0001';
  end if;
  if v_otp.verified_at is not null then
    raise exception 'Delivery was already confirmed for this order' using errcode = 'P0001';
  end if;
  if now() > v_otp.expires_at then
    raise exception 'This delivery code has expired' using errcode = 'P0001';
  end if;
  if v_otp.attempts >= v_otp.max_attempts then
    raise exception 'Too many incorrect attempts — ask Admin for help' using errcode = 'P0001';
  end if;

  if v_otp.code <> trim(p_code) then
    update public.order_otps set attempts = attempts + 1 where id = v_otp.id;
    raise exception 'Incorrect delivery code' using errcode = 'P0001';
  end if;

  update public.order_otps set verified_at = now() where id = v_otp.id;

  -- This is the ONLY status-changing step here, and it's the exact same
  -- transition ('out_for_delivery' -> 'delivered') the app already
  -- performs today via OrderStatusButton — so it still passes through
  -- the existing enforce_order_transition trigger and existing
  -- notif_order_event 'delivered' notifications untouched.
  update public.orders set status = 'delivered' where id = p_order_id;
end;
$$;

grant execute on function public.verify_pickup_otp(uuid, text) to authenticated;
grant execute on function public.verify_delivery_otp(uuid, text) to authenticated;
