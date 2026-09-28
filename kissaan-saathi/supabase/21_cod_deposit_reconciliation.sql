-- =====================================================================
-- 21_cod_deposit_reconciliation.sql
--
-- Purpose: Part C — "Delivery Partner deposits the collected amount with
-- the Admin. Admin records and reconciles the deposit." Until now there
-- was no tracking at all of collected-but-not-yet-deposited COD cash —
-- see 17_delivery_otp.sql / the app/api/delivery/collect-cod route for
-- how orders get marked payment_status = 'cod_collected'. This migration
-- adds the deposit step on top of that.
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
-- =====================================================================

create table if not exists public.cod_cash_deposits (
  id uuid primary key default gen_random_uuid(),
  delivery_partner_id uuid not null references public.profiles(id),
  order_ids uuid[] not null,
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id)
);

alter table public.orders add column if not exists cod_deposit_id uuid references public.cod_cash_deposits(id);

alter table public.cod_cash_deposits enable row level security;

drop policy if exists cod_cash_deposits_select_own on public.cod_cash_deposits;
create policy cod_cash_deposits_select_own on public.cod_cash_deposits
  for select to authenticated
  using (delivery_partner_id = auth.uid());

drop policy if exists cod_cash_deposits_select_admin on public.cod_cash_deposits;
create policy cod_cash_deposits_select_admin on public.cod_cash_deposits
  for select to authenticated
  using (is_admin());

-- No insert/update policy for any client role — only the two SECURITY
-- DEFINER functions below write here.

-- ---------------------------------------------------------------------
-- Delivery partner: "I'm depositing everything I've collected so far."
-- Claims every cod_collected order of theirs not already in a pending or
-- confirmed deposit, so the same cash can never be claimed twice.
-- ---------------------------------------------------------------------
create or replace function public.request_cod_deposit()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner uuid := auth.uid();
  v_order_ids uuid[];
  v_amount numeric;
  v_deposit_id uuid;
  v_admin_id uuid;
begin
  if v_partner is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}'), coalesce(sum(buyer_total), 0)
    into v_order_ids, v_amount
    from public.orders
   where delivery_partner_id = v_partner
     and payment_method = 'cod'
     and payment_status = 'cod_collected'
     and cod_deposit_id is null;

  if v_amount <= 0 then
    raise exception 'No collected cash to deposit' using errcode = 'P0001';
  end if;

  insert into public.cod_cash_deposits (delivery_partner_id, order_ids, amount)
  values (v_partner, v_order_ids, v_amount)
  returning id into v_deposit_id;

  update public.orders set cod_deposit_id = v_deposit_id where id = any(v_order_ids);

  begin
    for v_admin_id in select * from notif_admin_ids() loop
      perform create_notification(
        v_admin_id, 'cod_deposit_requested', 'Cash deposit awaiting confirmation',
        format('A delivery partner is depositing ₹%s in collected COD cash.', v_amount),
        '/admin/cod-deposits', '{}'::jsonb
      );
    end loop;
  exception when others then
    null;
  end;

  return v_deposit_id;
end;
$$;

grant execute on function public.request_cod_deposit() to authenticated;

-- ---------------------------------------------------------------------
-- Admin: confirms cash was physically received and reconciled.
-- ---------------------------------------------------------------------
create or replace function public.confirm_cod_deposit(p_deposit_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit record;
begin
  if not is_admin() then
    raise exception 'Admin only' using errcode = 'P0001';
  end if;

  select * into v_deposit from public.cod_cash_deposits where id = p_deposit_id for update;
  if v_deposit.id is null then
    raise exception 'Deposit not found' using errcode = 'P0001';
  end if;
  if v_deposit.status = 'confirmed' then
    raise exception 'This deposit was already confirmed' using errcode = 'P0001';
  end if;

  update public.cod_cash_deposits
    set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid(), note = coalesce(p_note, note)
    where id = p_deposit_id;

  begin
    perform create_notification(
      v_deposit.delivery_partner_id, 'cod_deposit_confirmed', 'Cash deposit confirmed',
      format('Admin confirmed your ₹%s cash deposit.', v_deposit.amount),
      '/delivery/earnings', '{}'::jsonb
    );
  exception when others then
    null;
  end;
end;
$$;

grant execute on function public.confirm_cod_deposit(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- NOTE for later: farmer settlement (19_farmer_withdrawal_and_auto_settlement.sql)
-- currently settles a farmer's seller_payout regardless of whether the
-- COD cash for that same order has actually been deposited + confirmed
-- yet. In practice Admin could pay a farmer via UPI before physically
-- having the corresponding COD cash in hand. This migration does not
-- change that — flagging it as a business-process decision for you
-- (e.g. "hold farmer settlement for COD orders until cod_deposit_id is
-- confirmed") rather than silently enforcing a rule you haven't asked for.
-- ---------------------------------------------------------------------
