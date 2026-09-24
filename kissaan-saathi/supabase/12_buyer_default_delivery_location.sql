-- =====================================================================
-- 12_buyer_default_delivery_location.sql
-- Auto-fill a new order's delivery drop-off location from the buyer's own
-- saved shop / delivery location — no more waiting on the buyer to fill in
-- order_delivery_locations after the farmer accepts.
--
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
--
-- Background: buyer_profiles already has `lat`, `lng`, `address` (added for
-- the marketplace "distance to farmer" feature). We reuse that SAME point
-- as the buyer's default delivery location — it doubles as "the shop /
-- place where every delivery should reach". The buyer now sets it once,
-- mandatorily, at signup (see app/signup/buyer/page.tsx) and can update it
-- any time from their profile (components/BuyerDefaultLocationForm.tsx).
--
-- Every new order is then pre-filled AND pre-confirmed here, so
-- GetDirectionsButton is visible to the delivery partner as soon as the
-- order is out for delivery — not after an extra buyer step.
--
-- The buyer can still open one specific order and change ITS location
-- (existing BuyerDeliveryLocationForm + order_delivery_locations flow,
-- completely untouched) if that single delivery needs to go somewhere else.
--
-- Assumed existing columns:
--   buyer_profiles(user_id, lat, lng, address)
--   orders(id, buyer_id, delivery_mode)
--   order_delivery_locations(order_id unique, delivery_latitude,
--     delivery_longitude, delivery_address, delivery_location_confirmed,
--     delivery_location_confirmed_at)
-- =====================================================================

create or replace function public.trg_default_order_delivery_location()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lat numeric; v_lng numeric; v_address text;
begin
  if new.delivery_mode is distinct from 'delivery' then
    return new;  -- Buyer Pickup orders use listing_pickup_locations instead.
  end if;

  select lat, lng, address into v_lat, v_lng, v_address
  from public.buyer_profiles where user_id = new.buyer_id;

  if v_lat is null or v_lng is null then
    return new;  -- Older account with no saved location yet — falls back
                 -- to the existing manual "Confirm Delivery Location" step.
  end if;

  insert into public.order_delivery_locations (
    order_id, delivery_latitude, delivery_longitude, delivery_address,
    delivery_location_confirmed, delivery_location_confirmed_at
  ) values (
    new.id, v_lat, v_lng, nullif(btrim(coalesce(v_address, '')), ''),
    true, now()
  )
  on conflict (order_id) do nothing;  -- never overwrite a location the
                                       -- buyer (or an earlier run) already set.

  return new;
exception when others then
  raise warning 'default delivery location failed: %', sqlerrm;
  return new;
end $$;

drop trigger if exists set_default_order_delivery_location on public.orders;
create trigger set_default_order_delivery_location
  after insert on public.orders
  for each row execute function public.trg_default_order_delivery_location();

-- Internal trigger function only — never callable directly from the browser.
revoke all on function public.trg_default_order_delivery_location() from public, anon, authenticated;
