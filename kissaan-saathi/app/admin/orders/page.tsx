import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Payment pending",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  cod_pending: "COD pending",
  cod_collected: "COD collected",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { payment?: string };
}) {
  const supabase = createClient();
  const paymentFilter = searchParams.payment;

  let query = supabase
    .from("orders")
    .select(
      "id, quantity, price_per_kg, buyer_total, status, payment_status, payment_method, delivery_mode, created_at, product_listings(name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (paymentFilter) {
    query = query.eq("payment_status", paymentFilter);
  }

  const { data: orders } = await query;

  const filters = [
    { value: "", label: "All" },
    { value: "cod_pending", label: "COD pending" },
    { value: "pending", label: "Payment pending" },
    { value: "paid", label: "Paid" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-4">Orders</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/orders?payment=${f.value}` : "/admin/orders"}
            className={`text-sm px-3 py-2 rounded-full whitespace-nowrap ${
              (paymentFilter ?? "") === f.value ? "bg-field text-sand" : "bg-field/10 text-field"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {(!orders || orders.length === 0) && <p className="text-soil/70">No orders found.</p>}

      <div className="flex flex-col gap-3">
        {orders?.map((o: any) => (
          <div key={o.id} className="card">
            <div className="flex justify-between items-start">
              <p className="font-medium text-soil">{o.product_listings?.name}</p>
              <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
                {o.status}
              </span>
            </div>
            <p className="text-soil/70 text-sm mt-1">
              {o.quantity} kg @ ₹{o.price_per_kg}/kg · Total ₹{o.buyer_total}
            </p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs bg-soil/10 text-soil rounded-full px-2 py-1">
                {o.delivery_mode === "pickup" ? "Buyer Pickup" : "Kissaan Saathi Delivery"}
              </span>
              <span className="text-xs bg-soil/10 text-soil rounded-full px-2 py-1">
                {o.payment_method === "cod" ? "COD" : "Online"}
              </span>
              <span
                className={`text-xs rounded-full px-2 py-1 ${
                  o.payment_status === "paid" || o.payment_status === "cod_collected"
                    ? "bg-field/10 text-field"
                    : o.payment_status === "failed"
                    ? "bg-alert/10 text-alert"
                    : "bg-marigold/20 text-marigold-dark"
                }`}
              >
                {PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
