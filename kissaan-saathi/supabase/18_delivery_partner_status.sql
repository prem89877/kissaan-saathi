-- =====================================================================
-- 18_delivery_partner_status.sql
--
-- Purpose: support Part D's "automatically assign the nearest available
-- delivery partner" requirement. Today there is no table that tracks a
-- delivery partner's general location/availability BEFORE they're
-- assigned to an order — delivery_partner_locations (from an earlier
-- migration) only tracks location for an order a partner is ALREADY
-- assigned to, for the buyer's live-tracking view. This is a separate,
-- new, additive table for the "who is nearby and free right now" question
-- that assignment needs to answer.
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
-- Does not touch delivery_partner_locations, orders, or any other
-- existing table.
-- =====================================================================

create table if not exists public.delivery_partner_status (
  partner_id uuid primary key references public.profiles(id) on delete cascade,
  is_online boolean not null default false,
  latitude numeric,
  longitude numeric,
  updated_at timestamptz not null default now()
);

alter table public.delivery_partner_status enable row level security;

-- A delivery partner can read/write only their own row.
drop policy if exists delivery_partner_status_select_own on public.delivery_partner_status;
create policy delivery_partner_status_select_own on public.delivery_partner_status
  for select to authenticated
  using (partner_id = auth.uid());

drop policy if exists delivery_partner_status_select_admin on public.delivery_partner_status;
create policy delivery_partner_status_select_admin on public.delivery_partner_status
  for select to authenticated
  using (is_admin());

drop policy if exists delivery_partner_status_insert_own on public.delivery_partner_status;
create policy delivery_partner_status_insert_own on public.delivery_partner_status
  for insert to authenticated
  with check (partner_id = auth.uid());

drop policy if exists delivery_partner_status_update_own on public.delivery_partner_status;
create policy delivery_partner_status_update_own on public.delivery_partner_status
  for update to authenticated
  using (partner_id = auth.uid())
  with check (partner_id = auth.uid());

-- Deliberately NO policy letting one partner see another's row — the
-- assignment algorithm (app/api/delivery/auto-assign) reads across all
-- partners using the service-role client, server-side only, exactly like
-- the existing pattern in app/delivery/dashboard/page.tsx for reading
-- farmer/buyer contact details.
