import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  negotiating: "Negotiating",
  agreed: "Agreed — awaiting confirmation",
  order_placed: "Order placed",
  accepted_by_seller: "Accepted by farmer",
  packing: "Packing",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
  refund_requested: "Refund requested",
  refunded: "Refunded",
  replacement_requested: "Replacement requested",
  replaced: "Replaced",
};

export default async function BuyerOrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, quantity, price_per_kg, buyer_total, status, listing_id, product_listings(name)")
    .eq("buyer_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Orders</h1>
      {(!orders || orders.length === 0) && (
        <p className="text-soil/70">
          No orders yet. Orders are created once you accept a farmer's offer in a negotiation.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {orders?.map((o: any) => (
          <Link key={o.id} href={`/buyer/orders/${o.id}`} className="card block">
            <div className="flex justify-between items-start">
              <p className="font-medium text-soil">{o.product_listings?.name}</p>
              <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
            </div>
            <p className="text-soil/70 text-sm mt-1">
              {o.quantity} kg @ ₹{o.price_per_kg}/kg · Total ₹{o.buyer_total}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
