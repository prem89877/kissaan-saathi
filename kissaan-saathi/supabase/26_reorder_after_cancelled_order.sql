-- =====================================================================
-- 26_reorder_after_cancelled_order.sql
--
-- Purpose: fix a pre-existing bug (not introduced this session, found
-- during testing) — once a buyer's order for a given accepted offer was
-- cancelled, they could never place a new order against that same offer:
--   1. ChatThread.tsx kept resolving "existingOrderId" to the cancelled
--      order and showing "View order" instead of the order-creation form
--      (fixed directly in ChatThread.tsx alongside this migration).
--   2. Even with that UI fixed, create_order_from_offer itself rejected a
--      second order for the same offer_id regardless of the first one's
--      status. This migration fixes that half of it.
--
-- This CREATE OR REPLACEs create_order_from_offer again (the same
-- function this project's own 15_create_order_from_offer_road_distance.sql
-- and 23_enforce_30km_delivery_radius.sql already modified — nothing
-- hidden or pre-existing here), changing only the duplicate-order check.
-- Everything else is identical to 23_enforce_30km_delivery_radius.sql.
--
-- Run ONCE, AFTER 23, in Supabase Dashboard > SQL Editor. Safe to re-run.
-- =====================================================================

-- =====================================================================
-- 23_enforce_30km_delivery_radius.sql
--
-- Purpose: close the gap flagged during Part D — "Orders beyond the
-- supported 30 km radius must not be accepted for delivery." Both
-- pricing functions (14_delivery_pricing_tiers.sql) already document
-- that they silently fall back to the top tier for any distance beyond
-- 30 km instead of rejecting — and create_order_from_offer
-- (15_create_order_from_offer_road_distance.sql, which this migration
-- also owns) only rejects beyond 70 km, not 30. That mismatch meant a
-- delivery order 30–70 km away could be created and silently charged the
-- 20–30 km rate.
--
-- This CREATE OR REPLACEs create_order_from_offer again (same function
-- this project's own 15_create_order_from_offer_road_distance.sql
-- already modified — nothing hidden or pre-existing here) to add a
-- delivery-mode-specific 30 km cap, while leaving the general 70 km
-- sanity check in place for Buyer Pickup orders (where the buyer, not a
-- delivery partner, decides how far they're willing to travel).
--
-- No Admin-override/exception flow exists yet for the "unless
-- Admin-authorized exception" part of that requirement — flagging that
-- separately since it needs its own UI (an admin action to place an
-- order manually past the cap, or approve a specific farmer-buyer pair).
-- Say if you want that built.
--
-- Run ONCE, AFTER 15, in Supabase Dashboard > SQL Editor. Safe to re-run.
-- =====================================================================

create or replace function public.create_order_from_offer(
  p_offer_id uuid,
  p_delivery_mode text default 'delivery'::text,
  p_payment_method text default 'online'::text,
  p_road_distance_km numeric default null
)
returns uuid
language plpgsql
as $function$
declare
  v_offer offers%rowtype;
  v_conversation conversations%rowtype;
  v_listing product_listings%rowtype;
  v_farmer_loc record;
  v_buyer_loc record;
  v_distance numeric;
  v_delivery_cost numeric;
  v_delivery_partner_earning numeric;
  v_totals record;
  v_initial_payment_status order_payment_status;
  v_order_id uuid;
begin
  if p_delivery_mode not in ('delivery', 'pickup') then
    raise exception 'Invalid delivery mode: %', p_delivery_mode;
  end if;
  if p_payment_method not in ('online', 'cod') then
    raise exception 'Invalid payment method: %', p_payment_method;
  end if;
  if p_delivery_mode = 'pickup' and p_payment_method = 'cod' then
    raise exception 'Cash on Delivery is not available for Buyer Pickup orders — online/UPI payment is required.';
  end if;

  select * into v_offer from offers where id = p_offer_id;
  if v_offer is null then
    raise exception 'Offer not found';
  end if;
  if v_offer.status <> 'accepted' then
    raise exception 'Offer must be accepted before an order can be created';
  end if;

  select * into v_conversation from conversations where id = v_offer.conversation_id;
  if v_conversation is null then
    raise exception 'Conversation not found for this offer';
  end if;
  if v_conversation.buyer_id <> auth.uid() then
    raise exception 'Only the buyer can place the order';
  end if;

  -- A CANCELLED order for this offer shouldn't permanently block the
  -- buyer from ordering again — only a still-live order (anything other
  -- than 'cancelled') should count as "already ordered". Fixes a
  -- pre-existing bug where cancelling an order left the buyer unable to
  -- ever re-order that same listing (see 26_reorder_after_cancelled_order.sql).
  if exists (select 1 from orders where offer_id = p_offer_id and status <> 'cancelled') then
    raise exception 'An order already exists for this offer';
  end if;

  select * into v_listing from product_listings where id = v_conversation.listing_id;
  if v_listing is null then
    raise exception 'Listing not found';
  end if;

  select lat, lng into v_farmer_loc from farmer_profiles where user_id = v_conversation.farmer_id;
  select lat, lng into v_buyer_loc from buyer_profiles where user_id = v_conversation.buyer_id;

  -- Prefer the road distance the API route computed server-side via OSRM;
  -- fall back to straight-line only if none was supplied.
  v_distance := coalesce(
    p_road_distance_km,
    haversine_km(v_farmer_loc.lat, v_farmer_loc.lng, v_buyer_loc.lat, v_buyer_loc.lng)
  );

  if v_distance is not null and v_distance > 70 then
    raise exception 'This farmer is % km away, which is beyond the 70 km service radius. Orders beyond 70 km are not allowed.', v_distance;
  end if;

  -- NEW: the pricing tiers (calculate_buyer_delivery_fee /
  -- calculate_delivery_partner_earning) only go up to 30 km — beyond that
  -- they silently charge the top-tier rate rather than reflecting real
  -- cost. Reject delivery-mode orders past 30 km outright instead of
  -- under-pricing them. Buyer Pickup is unaffected (no delivery partner or
  -- distance-based fee involved), so it still only stops at 70 km above.
  if p_delivery_mode = 'delivery' and v_distance is not null and v_distance > 30 then
    raise exception 'This farmer is % km away by road, which is beyond the 30 km delivery service radius. Ask the farmer about Buyer Pickup instead.', v_distance;
  end if;

  if p_delivery_mode = 'pickup' then
    v_delivery_cost := 0;
    v_delivery_partner_earning := 0;
  else
    v_delivery_cost := calculate_buyer_delivery_fee(v_distance, v_offer.quantity);
    v_delivery_partner_earning := calculate_delivery_partner_earning(v_distance);
  end if;

  select * into v_totals
  from calculate_order_totals(v_offer.quantity, v_offer.price_per_kg, v_delivery_cost);

  v_initial_payment_status := case when p_payment_method = 'cod' then 'cod_pending' else 'pending' end;

  insert into orders (
    listing_id, offer_id, farmer_id, buyer_id, quantity, price_per_kg,
    product_subtotal, delivery_cost, delivery_partner_earning, seller_fee, buyer_fee, buyer_total, seller_payout,
    status, delivery_mode, payment_method, payment_status
  ) values (
    v_listing.id, v_offer.id, v_conversation.farmer_id, v_conversation.buyer_id,
    v_offer.quantity, v_offer.price_per_kg,
    v_totals.product_subtotal, v_delivery_cost, v_delivery_partner_earning,
    v_totals.seller_fee, v_totals.buyer_fee, v_totals.buyer_total, v_totals.seller_payout,
    'agreed', p_delivery_mode, p_payment_method::order_payment_method, v_initial_payment_status
  )
  returning id into v_order_id;

  return v_order_id;
end;
$function$;
