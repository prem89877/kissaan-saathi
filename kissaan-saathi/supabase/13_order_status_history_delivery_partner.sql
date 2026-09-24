-- =====================================================================
-- 13_order_status_history_delivery_partner.sql
-- Fixes: "new row violates row-level security policy for table
-- order_status_history" when a delivery partner taps "Mark delivered".
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
--
-- Root cause: order_status_history_insert_participant (and the matching
-- _select_participant policy) only checked the order's farmer_id and
-- buyer_id. But enforce_order_transition() inserts a history row as
-- auth.uid() for EVERY status change, including ones made by the assigned
-- delivery partner (e.g. out_for_delivery -> delivered) — and the policy
-- had no delivery_partner_id branch, so that insert was always rejected.
--
-- This only widens who is allowed to insert/read — the actual status
-- transitions themselves are still validated by is_valid_order_transition()
-- inside enforce_order_transition(), completely untouched here.
-- =====================================================================

drop policy if exists order_status_history_insert_participant on public.order_status_history;
create policy order_status_history_insert_participant on public.order_status_history
  for insert to public
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (
          o.farmer_id = auth.uid()
          or o.buyer_id = auth.uid()
          or o.delivery_partner_id = auth.uid()
        )
    ) or is_admin()
  );

drop policy if exists order_status_history_select_participant on public.order_status_history;
create policy order_status_history_select_participant on public.order_status_history
  for select to public
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (
          o.farmer_id = auth.uid()
          or o.buyer_id = auth.uid()
          or o.delivery_partner_id = auth.uid()
        )
    ) or is_admin()
  );
