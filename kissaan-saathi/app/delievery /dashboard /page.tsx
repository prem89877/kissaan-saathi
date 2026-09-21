import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import DeliveryClaimButton from "@/components/DeliveryClaimButton";
import OrderStatusButton from "@/components/OrderStatusButton";

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

function listingName(row: OrderRow) {
  const pl = row.product_listings;
  if (!pl) return "Produce";
  return Array.isArray(pl) ? pl[0]?.name ?? "Produce" : pl.name;
}

export default async function DeliveryDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // RLS (orders_select_delivery) already limits this to: orders assigned to
  // me, or unassigned orders that are out_for_delivery + delivery_mode
  // 'delivery' — i.e. exactly the two buckets this page needs, nothing more.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, quantity, price_per_kg, delivery_cost, status, delivery_partner_id, farmer_id, buyer_id, product_listings(name)"
    )
    .eq("delivery_mode", "delivery")
    .eq("status", "out_for_delivery")
    .order("id", { ascending: false });

  const rows = (orders ?? []) as unknown as OrderRow[];
  const myDelivery = rows.filter((o) => o.delivery_partner_id === user!.id);
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

  function OrderCard({ order, mine }: { order: OrderRow; mine: boolean }) {
    const farmer = farmerMap.get(order.farmer_id) as any;
    const buyer = buyerMap.get(order.buyer_id) as any;
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
          <p className="text-soil/60">{buyer?.address}</p>
        </div>
        <p className="text-xs text-soil/50 mt-2">Delivery fee: ₹{order.delivery_cost}</p>
        <div className="mt-3">
          {mine ? (
            <OrderStatusButton orderId={order.id} targetStatus="delivered" label="Mark delivered" />
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
