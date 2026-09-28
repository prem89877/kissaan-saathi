-- =====================================================================
-- 19_farmer_withdrawal_and_auto_settlement.sql
--
-- Purpose: Part C — "Manual withdrawal available at >=₹500 eligible
-- balance, farmer taps Withdraw -> 3-day processing window. If farmer
-- doesn't withdraw, auto-settle on day 16 with a 2% bonus."
--
-- You confirmed no such day-16/bonus logic exists yet, so this is a new,
-- additive system alongside (not replacing) the existing admin-driven
-- create_farmer_settlement flow — see the IMPORTANT COMPATIBILITY NOTE
-- near the bottom before running this.
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent),
-- EXCEPT the pg_cron schedule line at the very bottom, which errors if
-- pg_cron isn't enabled on your project — see the note there.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New table: a withdrawal/auto-settlement REQUEST, distinct from
--    farmer_settlements (which — per the existing SettlementForm /
--    AdminSettlementsPage code — only ever represents a payment Admin
--    has ALREADY made). This table represents the earlier step: an
--    amount becoming due, either because the farmer tapped Withdraw or
--    because 16 days passed.
-- ---------------------------------------------------------------------
create table if not exists public.farmer_payout_requests (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles(id),
  source text not null check (source in ('manual_withdrawal', 'auto_day16')),
  order_ids uuid[] not null,
  eligible_amount numeric not null,
  bonus_amount numeric not null default 0,
  total_amount numeric not null,
  status text not null default 'processing' check (status in ('processing', 'fulfilled')),
  processing_until timestamptz not null,
  settlement_id uuid references public.farmer_settlements(id),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

alter table public.orders add column if not exists payout_request_id uuid references public.farmer_payout_requests(id);

alter table public.farmer_payout_requests enable row level security;

drop policy if exists farmer_payout_requests_select_own on public.farmer_payout_requests;
create policy farmer_payout_requests_select_own on public.farmer_payout_requests
  for select to authenticated
  using (farmer_id = auth.uid());

drop policy if exists farmer_payout_requests_select_admin on public.farmer_payout_requests;
create policy farmer_payout_requests_select_admin on public.farmer_payout_requests
  for select to authenticated
  using (is_admin());

-- No insert/update policy for any client role — only the two SECURITY
-- DEFINER functions below write to this table.

-- ---------------------------------------------------------------------
-- 2. Farmer taps "Withdraw". MIN_WITHDRAWAL = ₹500, PROCESSING_DAYS = 3.
-- ---------------------------------------------------------------------
create or replace function public.request_farmer_withdrawal()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farmer uuid := auth.uid();
  v_order_ids uuid[];
  v_eligible numeric;
  v_request_id uuid;
  v_admin_id uuid;
begin
  if v_farmer is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.farmer_payout_requests
    where farmer_id = v_farmer and status = 'processing'
  ) then
    raise exception 'You already have a withdrawal in progress' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}'), coalesce(sum(seller_payout), 0)
    into v_order_ids, v_eligible
    from public.orders
   where farmer_id = v_farmer
     and status in ('delivered', 'completed')
     and settlement_id is null
     and payout_request_id is null;

  if v_eligible < 500 then
    raise exception 'Minimum withdrawal amount is ₹500 (eligible balance: ₹%)', v_eligible
      using errcode = 'P0001';
  end if;

  insert into public.farmer_payout_requests (farmer_id, source, order_ids, eligible_amount, bonus_amount, total_amount, processing_until)
  values (v_farmer, 'manual_withdrawal', v_order_ids, v_eligible, 0, v_eligible, now() + interval '3 days')
  returning id into v_request_id;

  update public.orders set payout_request_id = v_request_id where id = any(v_order_ids);

  begin
    perform create_notification(
      v_farmer, 'withdrawal_requested', 'Withdrawal requested',
      format('Your withdrawal of ₹%s is processing — Admin will pay within 3 days.', v_eligible),
      '/farmer/earnings', '{}'::jsonb
    );
    for v_admin_id in select * from notif_admin_ids() loop
      perform create_notification(
        v_admin_id, 'withdrawal_requested_admin', 'Farmer withdrawal requested',
        format('A farmer requested a withdrawal of ₹%s — due within 3 days.', v_eligible),
        '/admin/payout-requests', '{}'::jsonb
      );
    end loop;
  exception when others then
    null;
  end;

  return v_request_id;
end;
$$;

grant execute on function public.request_farmer_withdrawal() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Day-16 auto-settlement, run daily. An order becomes eligible 16
--    days after it was marked 'delivered' (using order_status_history —
--    same source of truth as 16_dispute_six_hour_window.sql), if it
--    still isn't settled AND isn't already claimed by a pending
--    withdrawal request.
-- ---------------------------------------------------------------------
create or replace function public.auto_settle_day16_orders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farmer record;
  v_order_ids uuid[];
  v_eligible numeric;
  v_bonus numeric;
  v_request_id uuid;
  v_admin uuid;
begin
  for v_farmer in
    select o.farmer_id, array_agg(o.id) as order_ids, sum(o.seller_payout) as eligible
      from public.orders o
      join public.order_status_history h
        on h.order_id = o.id and h.status = 'delivered'
     where o.status in ('delivered', 'completed')
       and o.settlement_id is null
       and o.payout_request_id is null
       and h.created_at <= now() - interval '16 days'
     group by o.farmer_id
  loop
    v_order_ids := v_farmer.order_ids;
    v_eligible := v_farmer.eligible;
    v_bonus := round(v_eligible * 0.02, 2);

    insert into public.farmer_payout_requests
      (farmer_id, source, order_ids, eligible_amount, bonus_amount, total_amount, processing_until)
    values
      (v_farmer.farmer_id, 'auto_day16', v_order_ids, v_eligible, v_bonus, v_eligible + v_bonus, now() + interval '3 days')
    returning id into v_request_id;

    update public.orders set payout_request_id = v_request_id where id = any(v_order_ids);

    begin
      perform create_notification(
        v_farmer.farmer_id, 'withdrawal_auto_settled', 'Earnings auto-settled',
        format('₹%s was auto-settled with a 2%% bonus (₹%s) since it wasn''t withdrawn within 16 days.', v_eligible, v_bonus),
        '/farmer/earnings', '{}'::jsonb
      );
      for v_admin in select * from notif_admin_ids() loop
        perform create_notification(
          v_admin, 'withdrawal_auto_settled_admin', 'Auto-settlement due for payout',
          format('₹%s (incl. 2%% bonus) auto-settled for a farmer — due within 3 days.', v_eligible + v_bonus),
          '/admin/payout-requests', '{}'::jsonb
        );
      end loop;
    exception when others then
      null;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Admin fulfils a payout request (pays via UPI, records it here) —
--    separate from create_farmer_settlement so it only ever touches the
--    exact orders this specific request claimed, never anything else.
-- ---------------------------------------------------------------------
create or replace function public.fulfill_farmer_payout_request(
  p_request_id uuid,
  p_utr_reference text,
  p_payment_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_gross numeric;
  v_fee numeric;
  v_settlement_id uuid;
begin
  if not is_admin() then
    raise exception 'Admin only' using errcode = 'P0001';
  end if;

  select * into v_req from public.farmer_payout_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Payout request not found' using errcode = 'P0001';
  end if;
  if v_req.status = 'fulfilled' then
    raise exception 'This request was already paid' using errcode = 'P0001';
  end if;

  select coalesce(sum(product_subtotal), 0), coalesce(sum(seller_fee), 0)
    into v_gross, v_fee
    from public.orders where id = any(v_req.order_ids);

  insert into public.farmer_settlements
    (farmer_id, gross_amount, seller_fee, net_payable, amount_paid, utr_reference, payment_date, status)
  values
    (v_req.farmer_id, v_gross, v_fee, v_req.total_amount, v_req.total_amount, p_utr_reference, p_payment_date, 'paid')
  returning id into v_settlement_id;

  update public.orders set settlement_id = v_settlement_id where id = any(v_req.order_ids);
  update public.farmer_payout_requests
    set status = 'fulfilled', settlement_id = v_settlement_id, fulfilled_at = now()
    where id = p_request_id;

  begin
    perform create_notification(
      v_req.farmer_id, 'withdrawal_paid', 'Withdrawal paid',
      format('₹%s was paid to your UPI ID (UTR: %s).', v_req.total_amount, p_utr_reference),
      '/farmer/earnings', '{}'::jsonb
    );
  exception when others then
    null;
  end;

  return v_settlement_id;
end;
$$;

grant execute on function public.fulfill_farmer_payout_request(uuid, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- IMPORTANT COMPATIBILITY NOTE — please read before relying on this:
--
-- The existing create_farmer_settlement RPC (used by SettlementForm.tsx /
-- /admin/settlements) is defined in a migration I can't see (1-10), and
-- from its usage it appears to settle ALL of a farmer's currently-
-- unsettled orders (settlement_id is null) in one call — it doesn't know
-- about the new payout_request_id column this migration adds. If Admin
-- uses that OLD bulk-settle flow for a farmer who also has a 'processing'
-- row in farmer_payout_requests, it may sweep up and double-handle the
-- same orders. Until you either (a) confirm create_farmer_settlement
-- also excludes orders with payout_request_id set, or (b) retire the old
-- bulk flow in favor of always going through /admin/payout-requests, the
-- admin settlements page now shows a warning for any farmer with a
-- pending request (see the accompanying app change) — please don't use
-- the old "Mark as Paid" bulk button for that farmer until this is
-- resolved.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 5. Schedule the daily auto-settlement job via pg_cron.
--
-- pg_cron must be enabled on your Supabase project (Database > Extensions
-- > pg_cron) for this to do anything — if it's not available on your
-- plan, this line will error and you'll need to trigger
-- auto_settle_day16_orders() another way (e.g. a Vercel Cron hitting a
-- small API route that calls this RPC once a day).
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'auto-settle-day16-farmer-earnings',
  '0 3 * * *',  -- 03:00 UTC daily — adjust if you want a different time
  $$select public.auto_settle_day16_orders();$$
) where not exists (
  select 1 from cron.job where jobname = 'auto-settle-day16-farmer-earnings'
);
