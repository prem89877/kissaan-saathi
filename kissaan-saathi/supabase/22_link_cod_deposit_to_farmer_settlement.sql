-- =====================================================================
-- 22_link_cod_deposit_to_farmer_settlement.sql
--
-- Purpose: close the gap flagged in 21_cod_deposit_reconciliation.sql —
-- a farmer's COD order should not be withdrawable/auto-settled until the
-- delivery partner's collected cash for that order has actually been
-- deposited AND confirmed by Admin. Non-COD (online-paid) orders are
-- unaffected — they were never waiting on a physical cash handover.
--
-- This CREATE OR REPLACEs the two functions from
-- 19_farmer_withdrawal_and_auto_settlement.sql (which this migration
-- owns — not a hidden pre-existing function) to add one extra condition
-- to their eligibility query. Nothing else about them changes.
--
-- Run ONCE, AFTER 19 and 21, in Supabase Dashboard > SQL Editor. Safe to
-- re-run (idempotent).
-- =====================================================================

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

  select coalesce(array_agg(o.id), '{}'), coalesce(sum(o.seller_payout), 0)
    into v_order_ids, v_eligible
    from public.orders o
   where o.farmer_id = v_farmer
     and o.status in ('delivered', 'completed')
     and o.settlement_id is null
     and o.payout_request_id is null
     and (
       o.payment_method <> 'cod'
       or exists (
         select 1 from public.cod_cash_deposits d
          where d.id = o.cod_deposit_id and d.status = 'confirmed'
       )
     );

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
       and (
         o.payment_method <> 'cod'
         or exists (
           select 1 from public.cod_cash_deposits d
            where d.id = o.cod_deposit_id and d.status = 'confirmed'
         )
       )
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
-- IMPORTANT CONSEQUENCE — please be aware:
--
-- A farmer with a COD order whose cash the delivery partner hasn't
-- deposited (or Admin hasn't confirmed) yet will now simply have that
-- order excluded from their eligible balance — indefinitely, until the
-- deposit is confirmed. There's no separate alert for "this farmer's
-- money is stuck waiting on a partner's cash deposit." If you want one,
-- say so and I'll add an Admin-facing view for it (e.g. surfaced on
-- /admin/cod-deposits: "N delivered COD orders older than X days still
-- awaiting deposit").
-- ---------------------------------------------------------------------
