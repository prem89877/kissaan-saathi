-- =====================================================================
-- 16_dispute_six_hour_window.sql
--
-- Purpose: enforce the "buyer can only file a quality complaint within
-- 6 hours of delivery" rule using the DATABASE clock, not just frontend
-- validation (per business rules Part B.3/B.4).
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
-- This migration is ADDITIVE ONLY:
--   - It does not drop, alter, or recreate the `disputes` table.
--   - It does not touch existing rows or existing policies on other tables.
--   - It only adds one trigger function + one trigger on `disputes`.
--
-- Source of truth for "delivered at": the existing order_status_history
-- table (see 13_order_status_history_delivery_partner.sql), specifically
-- the most recent row for that order with status = 'delivered'. This is
-- populated by the existing enforce_order_transition() trigger, so no new
-- timestamp column is introduced.
--
-- PRE-REQUISITE CHECK BEFORE RUNNING:
-- This assumes order_status_history has columns (order_id, status,
-- created_at) and that a 'delivered' row is inserted at the moment the
-- order transitions to delivered. If your live schema differs (e.g. the
-- delivered timestamp lives on orders.delivered_at instead), do NOT run
-- this as-is — tell me the actual column and I'll adjust the query below
-- before you run it.
-- =====================================================================

create or replace function public.enforce_dispute_six_hour_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delivered_at timestamptz;
begin
  select created_at
    into delivered_at
    from public.order_status_history
   where order_id = new.order_id
     and status = 'delivered'
   order by created_at desc
   limit 1;

  if delivered_at is null then
    raise exception 'Cannot file a complaint: this order has not been marked delivered yet.'
      using errcode = 'P0001';
  end if;

  if now() > delivered_at + interval '6 hours' then
    raise exception 'The 6-hour window to report a problem with this delivery has passed.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_dispute_six_hour_window on public.disputes;
create trigger trg_enforce_dispute_six_hour_window
  before insert on public.disputes
  for each row
  execute function public.enforce_dispute_six_hour_window();
