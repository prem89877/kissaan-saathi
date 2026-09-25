-- Replaces create_order_from_offer to:
--  1. accept p_road_distance_km (sent by app/api/orders/create-from-offer/route.ts,
--     computed server-side via OSRM) with a default of null so nothing else
--     calling this function without it will break;
--  2. fall back to the existing haversine_km(...) calc only when no road
--     distance was supplied (e.g. pickup orders, or if OSRM was unreachable
--     and the route already fell back itself);
--  3. use the new tiered calculate_buyer_delivery_fee() instead of the old
--     calculate_delivery_cost();
--  4. also compute and store delivery_partner_earning via
--     calculate_delivery_partner_earning(), instead of paying the delivery
--     partner the buyer's full delivery_cost.
--
-- Everything else (offer/conversation checks, 70 km radius check, totals,
-- COD/pickup rules) is untouched from what pg_get_functiondef returned.

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

  if exists (select 1 from orders where offer_id = p_offer_id) then
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
