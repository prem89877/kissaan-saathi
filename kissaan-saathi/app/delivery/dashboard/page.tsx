import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import DeliveryClaimButton from "@/components/DeliveryClaimButton";
import OrderStatusButton from "@/components/OrderStatusButton";
import GetDirectionsButton from "@/components/GetDirectionsButton";
import DeliveryLocationShareButton from "@/components/DeliveryLocationShareButton";
import Link from "next/link";

type OrderRow = {
  id: string;
  quantity: number;
  price_per_kg: number;
  delivery_cost: number;
  status: string;
  delivery_partner_id: string | null;
  farmer_id: string;
  buyer_id: string;
  product_listings: { name: string } | { name: string }[] | null;
};

type DeliveryLocationRow = {
  order_id: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_address: string | null;
  delivery_landmark: string | null;
  delivery_instructions: string | null;
};

function listingName(row: OrderRow) {
  const pl = row.product_listings;
  if (!pl) return "Produce";
  return Array.isArray(pl) ? pl[0]?.name ?? "Produce" : pl.name;
}

export default async function DeliveryDashboard() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  // RLS (orders_select_delivery) already limits this to: orders assigned to
  // me, or unassigned orders that are out_for_delivery + delivery_mode
  // 'delivery' — i.e. exactly the two buckets this page needs, nothing more.
  // These two are independent of each other — fetch in parallel instead of
  // one after another.
  const [{ data: orders }, { data: pendingSettlementOrders }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, quantity, price_per_kg, delivery_cost, status, delivery_partner_id, farmer_id, buyer_id, product_listings(name)"
      )
      .eq("delivery_mode", "delivery")
      .eq("status", "out_for_delivery")
      .order("id", { ascending: false }),
    supabase
      .from("orders")
      .select("delivery_cost")
      .eq("delivery_partner_id", userId)
      .eq("delivery_mode", "delivery")
      .in("status", ["delivered", "completed"])
      .is("delivery_settlement_id", null),
  ]);

  const pendingBalance = (pendingSettlementOrders ?? []).reduce((sum, o) => sum + Number(o.delivery_cost), 0);

  const rows = (orders ?? []) as unknown as OrderRow[];
  const myDelivery = rows.filter((o) => o.delivery_partner_id === userId);
  const available = rows.filter((o) => o.delivery_partner_id === null);

  // Pickup (farmer) / drop-off (buyer) contact details aren't needed by the
  // orders_select_delivery policy above and this app's profiles/farmer_profiles/
  // buyer_profiles RLS isn't scoped for the delivery role yet, so we read
  // them server-side with the service role client — never exposed to the
  // browser, same pattern already used by the payment routes.
  const farmerIds = Array.from(new Set(rows.map((o) => o.farmer_id)));
  const buyerIds = Array.from(new Set(rows.map((o) => o.buyer_id)));

  const admin = createServiceRoleClient();
  const [{ data: farmerProfiles }, { data: farmerDetails }, { data: buyerProfiles }, { data: buyerDetails }] =
    await Promise.all([
      admin.from("profiles").select("id, full_name, phone").in("id", farmerIds.length ? farmerIds : [""]),
      admin.from("farmer_profiles").select("user_id, farm_name, area, address").in("user_id", farmerIds.length ? farmerIds : [""]),
      admin.from("profiles").select("id, full_name, phone").in("id", buyerIds.length ? buyerIds : [""]),
      admin.from("buyer_profiles").select("user_id, business_name, address").in("user_id", buyerIds.length ? buyerIds : [""]),
    ]);

  const farmerMap = new Map(farmerIds.map((id) => [id, {
    ...farmerProfiles?.find((p) => p.id === id),
    ...farmerDetails?.find((d) => d.user_id === id),
  }]));
  const buyerMap = new Map(buyerIds.map((id) => [id, {
    ...buyerProfiles?.find((p) => p.id === id),
    ...buyerDetails?.find((d) => d.user_id === id),
  }]));

  // NEW: buyer's confirmed delivery location + this partner's own live-share
  // state, only for orders currently assigned to me. RLS
  // (10_buyer_delivery_and_live_tracking.sql) already scopes both tables to
  // "assigned delivery partner", so the ordinary authenticated client
  // (not the service-role client above) is enough here — no bypass needed.
  const myOrderIds = myDelivery.map((o) => o.id);
  const [{ data: deliveryLocations }, { data: liveLocations }] = await Promise.all([
    myOrderIds.length
      ? supabase
          .from("order_delivery_locations")
          .select("order_id, delivery_latitude, delivery_longitude, delivery_address, delivery_landmark, delivery_instructions")
          .in("order_id", myOrderIds)
      : Promise.resolve({ data: [] as DeliveryLocationRow[] }),
    myOrderIds.length
      ? supabase.from("delivery_partner_locations").select("order_id, is_active").in("order_id", myOrderIds)
      : Promise.resolve({ data: [] as { order_id: string; is_active: boolean }[] }),
  ]);

  const deliveryLocationMap = new Map((deliveryLocations ?? []).map((d) => [d.order_id, d]));
  const activeShareMap = new Map((liveLocations ?? []).map((l) => [l.order_id, l.is_active]));

  function OrderCard({ order, mine }: { order: OrderRow; mine: boolean }) {
    const farmer = farmerMap.get(order.farmer_id) as any;
    const buyer = buyerMap.get(order.buyer_id) as any;
    const deliveryLocation = mine ? deliveryLocationMap.get(order.id) : undefined;
    return (
      <div className="card border-field">
        <p className="font-medium text-field">{listingName(order)} · {order.quantity} kg</p>
        <div className="text-sm text-soil/80 mt-2">
          <p className="font-medium text-soil">Pickup from</p>
          <p>{farmer?.full_name} {farmer?.phone ? `· ${farmer.phone}` : ""}</p>
          <p className="text-soil/60">{[farmer?.farm_name, farmer?.area, farmer?.address].filter(Boolean).join(", ")}</p>
        </div>
        <div className="text-sm text-soil/80 mt-2">
          <p className="font-medium text-soil">Deliver to</p>
          <p>{buyer?.business_name} {buyer?.phone ? `· ${buyer.phone}` : ""}</p>
          {deliveryLocation?.delivery_address ? (
            <>
              <p className="text-soil/60">{deliveryLocation.delivery_address}</p>
              {deliveryLocation.delivery_landmark && (
                <p className="text-soil/60">Landmark: {deliveryLocation.delivery_landmark}</p>
              )}
              {deliveryLocation.delivery_instructions && (
                <p className="text-soil/60">Note: {deliveryLocation.delivery_instructions}</p>
              )}
              {deliveryLocation.delivery_latitude != null && deliveryLocation.delivery_longitude != null && (
                <div className="mt-2">
                  <GetDirectionsButton
                    latitude={deliveryLocation.delivery_latitude}
                    longitude={deliveryLocation.delivery_longitude}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-soil/60">{buyer?.address}</p>
          )}
        </div>
        <p className="text-xs text-soil/50 mt-2">Delivery fee: ₹{order.delivery_cost}</p>
        <div className="mt-3 flex flex-col gap-3">
          {mine ? (
            <>
              <DeliveryLocationShareButton orderId={order.id} initialActive={activeShareMap.get(order.id) ?? false} userId={userId} />
              <OrderStatusButton orderId={order.id} targetStatus="delivered" label="Mark delivered" />
            </>
          ) : (
            <DeliveryClaimButton orderId={order.id} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <h1 className="font-display text-2xl text-field">Dashboard</h1>

      <Link href="/delivery/earnings" className="card border-field block">
        <p className="text-sm text-soil/70">Pending settlement balance</p>
        <p className="text-2xl font-display text-field">₹{pendingBalance.toFixed(2)}</p>
        <p className="text-soil/50 text-xs mt-1">Paid every Sunday via UPI · tap to view history</p>
      </Link>

      <section>
        <h2 className="font-medium text-field mb-3">My active delivery ({myDelivery.length})</h2>
        {myDelivery.length === 0 ? (
          <p className="text-soil/60 text-sm">You haven't accepted a delivery yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {myDelivery.map((o) => <OrderCard key={o.id} order={o} mine />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-medium text-field mb-3">Available for pickup ({available.length})</h2>
        {available.length === 0 ? (
          <p className="text-soil/60 text-sm">No orders waiting for pickup right now.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {available.map((o) => <OrderCard key={o.id} order={o} mine={false} />)}
          </div>
        )}
      </section>
    </div>
  );
}
