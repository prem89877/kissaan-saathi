-- Tiered delivery pricing: buyer delivery fee, delivery-partner earning,
-- and the platform margin between them. Mirrors lib/deliveryPricing.ts.
--
-- distance_km is expected to be one-way road distance. Today the app only
-- has straight-line (haversine) distance via lib/distance.ts — these
-- functions don't care where the number comes from, but the ₹ slabs below
-- were given for road distance, so real road-distance routing will give
-- more accurate fees than what the app currently computes.

create or replace function calculate_buyer_delivery_fee(distance_km numeric, weight_kg numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  d numeric := greatest(coalesce(distance_km, 0), 0);
  w numeric := greatest(coalesce(weight_kg, 0), 0);
  distance_fee numeric;
  weight_fee numeric;
begin
  distance_fee := case
    when d <= 2 then 20
    when d <= 5 then 30
    when d <= 10 then 45
    when d <= 15 then 60
    when d <= 20 then 80
    else 110 -- covers 20–30 km, and is the fallback beyond 30 km (no slab defined past that)
  end;

  weight_fee := case when w > 30 then (w - 30) * 2 else 0 end;

  return round(distance_fee + weight_fee, 2);
end;
$$;

create or replace function calculate_delivery_partner_earning(distance_km numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  d numeric := greatest(coalesce(distance_km, 0), 0);
begin
  return case
    when d <= 2 then 15
    when d <= 5 then 22
    when d <= 10 then 35
    when d <= 15 then 45
    when d <= 20 then 60
    else 80 -- covers 20–30 km, and is the fallback beyond 30 km
  end;
end;
$$;

-- orders.delivery_cost already holds the buyer-facing delivery fee (see
-- calculate_order_totals in the earlier migration that isn't in this
-- export). These two new columns separate out what the delivery partner is
-- actually paid, and what the platform keeps as margin, instead of the
-- current behaviour where settlements pay out 100% of delivery_cost.
alter table orders add column if not exists delivery_partner_earning numeric;
alter table orders add column if not exists platform_delivery_margin numeric
  generated always as (coalesce(delivery_cost, 0) - coalesce(delivery_partner_earning, 0)) stored;

comment on column orders.delivery_partner_earning is
  'What the delivery partner is paid for this order (calculate_delivery_partner_earning, or a proportional trip-split amount for multi-order routes). NULL until backfilled/set at order time.';
comment on column orders.platform_delivery_margin is
  'delivery_cost (buyer fee) minus delivery_partner_earning. Generated column — do not write to it directly.';

-- ---------------------------------------------------------------------
-- Wiring this in (do this part by hand — create_order_from_offer isn't in
-- this export, so it can't be safely rewritten from here):
--
-- 1. In create_order_from_offer (or wherever delivery_cost is currently
--    set on insert), replace the old calculate_delivery_cost(...) call
--    with calculate_buyer_delivery_fee(distance_km, quantity_kg), and also
--    set delivery_partner_earning = calculate_delivery_partner_earning(distance_km)
--    on the same insert.
--
-- 2. One-off backfill for existing orders once you can compute their
--    distance_km (swap in whatever expression gives you that per order —
--    there's no stored distance column today):
--
--    update orders
--    set delivery_partner_earning = delivery_cost
--    where delivery_partner_earning is null;
--    -- (keeps existing orders paying out 100% as before, since their
--    -- original distance isn't stored anywhere to recompute from)
--
-- 3. Point everywhere that currently reads delivery_cost to mean "what the
--    delivery partner earns" (delivery-settlements pages, delivery
--    earnings/dashboard/orders pages — see accompanying .tsx changes) at
--    delivery_partner_earning instead.
-- ---------------------------------------------------------------------
