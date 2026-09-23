import { createClient } from "@/lib/supabase/server";
import DeliverySettlementForm from "@/components/DeliverySettlementForm";
import Link from "next/link";

export default async function AdminDeliverySettlementDetailPage({
  params,
}: {
  params: { deliveryPartnerId: string };
}) {
  const supabase = createClient();

  const [{ data: profile }, { data: deliveryProfile }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", params.deliveryPartnerId).single(),
    supabase
      .from("delivery_profiles")
      .select("upi_id, upi_holder_name")
      .eq("user_id", params.deliveryPartnerId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, delivery_cost, status, product_listings(name)")
      .eq("delivery_partner_id", params.deliveryPartnerId)
      .eq("delivery_mode", "delivery")
      .in("status", ["delivered", "completed"])
      .is("delivery_settlement_id", null)
      .order("created_at", { ascending: true }),
  ]);

  const net = (orders ?? []).reduce((sum, o) => sum + Number(o.delivery_cost), 0);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/admin/delivery-settlements" className="text-field underline text-sm">← Back to delivery settlements</Link>

      <div>
        <h1 className="font-display text-2xl text-field">{profile?.full_name}</h1>
        <p className="text-soil/60 text-sm">{profile?.phone}</p>
      </div>

      <section className="card">
        <h2 className="font-medium text-field mb-2">UPI details</h2>
        <p>{deliveryProfile?.upi_id || "Not set — ask the delivery partner to add this in their profile."}</p>
        <p className="text-soil/60 text-sm">{deliveryProfile?.upi_holder_name}</p>
      </section>

      <section className="card border-field">
        <h2 className="font-medium text-field mb-2">
          {orders?.length ?? 0} order{(orders?.length ?? 0) === 1 ? "" : "s"} pending settlement
        </h2>
        <div className="flex justify-between font-medium text-field border-t border-soil/10 pt-2 mt-1">
          <span>Net payable</span><span>₹{net.toFixed(2)}</span>
        </div>
      </section>

      <section>
        <h2 className="font-medium text-field mb-2">Orders included</h2>
        <div className="flex flex-col gap-2">
          {orders?.map((o: any) => (
            <div key={o.id} className="card">
              <p className="text-sm text-soil">{o.product_listings?.name}</p>
              <p className="text-soil/60 text-xs">Delivery fee ₹{o.delivery_cost}</p>
            </div>
          ))}
        </div>
      </section>

      {net > 0 ? (
        <DeliverySettlementForm deliveryPartnerId={params.deliveryPartnerId} suggestedAmount={net} />
      ) : (
        <p className="text-soil/70">Nothing pending for this delivery partner.</p>
      )}
    </div>
  );
}
