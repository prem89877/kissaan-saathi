import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  out_for_delivery: "Picked up — delivering",
  delivered: "Delivered",
  completed: "Completed",
  disputed: "Disputed",
};

export default async function DeliveryOrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, quantity, price_per_kg, delivery_cost, status, product_listings(name)")
    .eq("delivery_partner_id", user!.id)
    .order("assigned_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">My deliveries</h1>
      {(!orders || orders.length === 0) && (
        <p className="text-soil/70">You haven't accepted any deliveries yet — check the Dashboard tab.</p>
      )}
      <div className="flex flex-col gap-3">
        {orders?.map((o: any) => (
          <div key={o.id} className="card">
            <div className="flex justify-between items-start">
              <p className="font-medium text-soil">{o.product_listings?.name}</p>
              <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
            </div>
            <p className="text-soil/70 text-sm mt-1">
              {o.quantity} kg · Delivery fee ₹{o.delivery_cost}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
