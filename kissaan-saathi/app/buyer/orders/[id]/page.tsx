import { createClient } from "@/lib/supabase/server";
import OrderStatusButton from "@/components/OrderStatusButton";
import DisputeButton from "@/components/DisputeButton";
import PaymentButton from "@/components/PaymentButton";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  negotiating: "Negotiating",
  agreed: "Agreed — awaiting confirmation",
  order_placed: "Order placed",
  accepted_by_seller: "Accepted by farmer",
  packing: "Farmer is packing your order",
  packed: "Packed — awaiting delivery",
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

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Payment pending",
  processing: "Payment processing",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
  cod_pending: "Cash on Delivery — pay on delivery",
  cod_collected: "Cash on Delivery — collected",
};

const PHOTO_VISIBLE_STATUSES = ["packing", "packed", "out_for_delivery", "delivered", "completed", "disputed"];

export default async function BuyerOrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, quantity, price_per_kg, product_subtotal, delivery_cost, buyer_fee, buyer_total, status, farmer_id, listing_id, delivery_mode, payment_method, payment_status, product_listings(name)"
    )
    .eq("id", params.id)
    .single();

  if (!order) return <p className="text-soil/70">Order not found.</p>;

  const { data: buyerProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user!.id)
    .single();

  const { data: farmerProfile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", order.farmer_id)
    .single();

  const { data: evidenceRows } = await supabase
    .from("packing_evidence")
    .select("storage_path")
    .eq("order_id", order.id);

  const { data: dispute } = await supabase
    .from("disputes")
    .select("id, reason, description, status, resolution, resolution_notes")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const photoUrls = PHOTO_VISIBLE_STATUSES.includes(order.status)
    ? await Promise.all(
        (evidenceRows ?? []).map(async (row) => {
          const { data } = await supabase.storage.from("packing-evidence").createSignedUrl(row.storage_path, 3600);
          return data?.signedUrl ?? null;
        })
      )
    : [];

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/buyer/orders" className="text-field underline text-sm">← Back to orders</Link>

      <div>
        <div className="flex justify-between items-start">
          {/* @ts-expect-error - relation typed loosely for MVP */}
          <h1 className="font-display text-2xl text-field">{order.product_listings?.name}</h1>
          <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>
        <p className="text-soil/60 text-sm">from {farmerProfile?.full_name} · {farmerProfile?.phone}</p>
        <div className="flex gap-2 mt-2">
          <span className="text-xs bg-soil/10 text-soil rounded-full px-2 py-1">
            {order.delivery_mode === "pickup" ? "Buyer Pickup" : "Kissaan Saathi Delivery"}
          </span>
          <span
            className={`text-xs rounded-full px-2 py-1 ${
              order.payment_status === "paid" || order.payment_status === "cod_collected"
                ? "bg-field/10 text-field"
                : order.payment_status === "failed"
                ? "bg-alert/10 text-alert"
                : "bg-marigold/20 text-marigold-dark"
            }`}
          >
            {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
          </span>
        </div>
      </div>

      <section className="card border-field">
        <h2 className="font-medium text-field mb-3">Order breakdown</h2>
        <div className="flex flex-col gap-1 text-soil/90">
          <div className="flex justify-between"><span>{order.quantity} kg @ ₹{order.price_per_kg}/kg</span><span>₹{order.product_subtotal}</span></div>
          <div className="flex justify-between">
            <span>{order.delivery_mode === "pickup" ? "Kissaan Saathi Delivery (self-pickup)" : "Kissaan Saathi Delivery charge"}</span>
            <span>₹{order.delivery_cost}</span>
          </div>
          <div className="flex justify-between"><span>Buyer platform fee (5%)</span><span>₹{order.buyer_fee}</span></div>
          <div className="flex justify-between font-medium text-field border-t border-soil/10 pt-2 mt-1">
            <span>Total payable</span><span>₹{order.buyer_total}</span>
          </div>
        </div>
      </section>

      {order.payment_method === "online" && order.payment_status !== "paid" && order.status !== "cancelled" && (
        <PaymentButton
          orderId={order.id}
          amount={order.buyer_total}
          buyerName={buyerProfile?.full_name}
          buyerEmail={buyerProfile?.email}
        />
      )}
      {order.payment_method === "online" && order.status === "agreed" && (
        <p className="text-soil/60 text-xs text-center -mt-2">
          Paying confirms and places your order — no separate confirmation step needed.
        </p>
      )}

      {order.payment_method === "cod" && order.status === "agreed" && (
        <OrderStatusButton orderId={order.id} targetStatus="order_placed" label="Confirm & place order (Cash on Delivery)" />
      )}

      {(order.status === "agreed" || order.status === "order_placed") && (
        <OrderStatusButton orderId={order.id} targetStatus="cancelled" label="Cancel order" variant="secondary" />
      )}

      {order.status === "accepted_by_seller" && (
        <p className="text-soil/70 text-sm">Farmer has accepted your order and will begin packing shortly.</p>
      )}

      {order.status === "packing" && (
        <p className="text-soil/70 text-sm">
          Farmer is packing your order ({evidenceRows?.length ?? 0} photo(s) uploaded so far).
        </p>
      )}

      {order.status === "packed" && (
        <p className="text-soil/70 text-sm">
          {order.delivery_mode === "pickup"
            ? "Your order is packed and ready for you to pick up from the farmer."
            : "Your order is packed and waiting to be dispatched."}
        </p>
      )}

      {order.status === "out_for_delivery" && (
        <OrderStatusButton
          orderId={order.id}
          targetStatus="delivered"
          label={order.delivery_mode === "pickup" ? "Mark as picked up" : "Mark as delivered"}
        />
      )}

      {order.status === "delivered" && (
        <div className="flex flex-col gap-2">
          <OrderStatusButton orderId={order.id} targetStatus="completed" label="Confirm receipt — mark completed" />
          <DisputeButton orderId={order.id} />
        </div>
      )}

      {dispute && (
        <section className="card border-alert">
          <h2 className="font-medium text-alert mb-1">Dispute — {dispute.status}</h2>
          <p className="text-soil/80 text-sm">{dispute.reason}</p>
          <p className="text-soil/70 text-sm mt-1">{dispute.description}</p>
          {dispute.resolution && (
            <p className="text-field text-sm mt-2 font-medium">
              Resolution: {dispute.resolution.replace(/_/g, " ")}
              {dispute.resolution_notes ? ` — ${dispute.resolution_notes}` : ""}
            </p>
          )}
        </section>
      )}

      {photoUrls.length > 0 && (
        <section>
          <h2 className="font-medium text-field mb-2">Packing photos ({photoUrls.length})</h2>
          <div className="grid grid-cols-3 gap-2">
            {photoUrls.map((url, i) =>
              url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-card" />
              ) : null
            )}
          </div>
          <p className="text-soil/50 text-xs mt-2">
            These photos are evidence for transparency and dispute resolution — not a guarantee of quality or quantity.
          </p>
        </section>
      )}
    </div>
  );
}
