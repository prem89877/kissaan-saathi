import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  negotiating: "Negotiating",
  agreed: "Agreed — awaiting buyer",
  order_placed: "New order — needs your acceptance",
  accepted_by_seller: "Accepted — start packing",
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

export default async function FarmerOrdersPage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, quantity, price_per_kg, seller_payout, status, product_listings(name)")
    .eq("farmer_id", userId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Orders</h1>
      {(!orders || orders.length === 0) && (
        <p className="text-soil/70">
          No orders yet. They appear here once a buyer places an order from an accepted offer.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {orders?.map((o: any) => (
          <Link key={o.id} href={`/farmer/orders/${o.id}`} className="card block">
            <div className="flex justify-between items-start">
              <p className="font-medium text-soil">{o.product_listings?.name}</p>
              <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
            </div>
            <p className="text-soil/70 text-sm mt-1">
              {o.quantity} kg @ ₹{o.price_per_kg}/kg · Your payout ₹{o.seller_payout}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
