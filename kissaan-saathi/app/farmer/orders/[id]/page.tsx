import { createClient } from "@/lib/supabase/server";
import OrderStatusButton from "@/components/OrderStatusButton";
import PackingEvidenceUploader from "@/components/PackingEvidenceUploader";
import CodCollectButton from "@/components/CodCollectButton";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  negotiating: "Negotiating",
  agreed: "Agreed — awaiting buyer",
  order_placed: "New order — needs your acceptance",
  accepted_by_seller: "Accepted — ready to pack",
  packing: "Packing in progress",
  packed: "Packed — ready for delivery",
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
  cod_pending: "Cash on Delivery — collect on delivery",
  cod_collected: "Cash on Delivery — collected",
};

const PHOTO_VISIBLE_STATUSES = ["packing", "packed", "out_for_delivery", "delivered", "completed", "disputed"];

export default async function FarmerOrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, quantity, price_per_kg, product_subtotal, seller_fee, seller_payout, status, buyer_id, listing_id, delivery_mode, payment_method, payment_status, product_listings(name)"
    )
    .eq("id", params.id)
    .single();

  if (!order) return <p className="text-soil/70">Order not found.</p>;

  const { data: buyerProfile } = await supabase
    .from("buyer_profiles")
    .select("business_name, business_type, address")
    .eq("user_id", order.buyer_id)
    .single();

  const { data: evidenceRows } = await supabase
    .from("packing_evidence")
    .select("storage_path")
    .eq("order_id", order.id);

  const { data: dispute } = await supabase
    .from("disputes")
    .select("reason, description, status, resolution, resolution_notes")
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
      <Link href="/farmer/orders" className="text-field underline text-sm">← Back to orders</Link>

      <div>
        <div className="flex justify-between items-start">
          {/* @ts-expect-error - relation typed loosely for MVP */}
          <h1 className="font-display text-2xl text-field">{order.product_listings?.name}</h1>
          <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>
        <p className="text-soil/60 text-sm">
          Buyer: {buyerProfile?.business_name} ({buyerProfile?.business_type})
        </p>
        <p className="text-soil/60 text-sm">{buyerProfile?.address}</p>
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
        {order.delivery_mode === "pickup" ? (
          <p className="text-soil/60 text-sm mt-1">
            Buyer will self-pickup — no delivery needed from you.{" "}
            <Link href={`/farmer/listings/${order.listing_id}/pickup-location`} className="text-field underline">
              Manage pickup location
            </Link>
          </p>
        ) : (
          <p className="text-soil/60 text-sm mt-1">Kissaan Saathi Delivery handles this order's delivery.</p>
        )}
      </div>

      <section className="card border-field">
        <h2 className="font-medium text-field mb-3">Your payout breakdown</h2>
        <div className="flex flex-col gap-1 text-soil/90">
          <div className="flex justify-between"><span>{order.quantity} kg @ ₹{order.price_per_kg}/kg</span><span>₹{order.product_subtotal}</span></div>
          <div className="flex justify-between"><span>Seller platform fee</span><span>− ₹{order.seller_fee}</span></div>
          <div className="flex justify-between font-medium text-field border-t border-soil/10 pt-2 mt-1">
            <span>You receive</span><span>₹{order.seller_payout}</span>
          </div>
        </div>
      </section>

      {order.status === "order_placed" && (
        <div className="flex flex-col gap-2">
          <OrderStatusButton orderId={order.id} targetStatus="accepted_by_seller" label="Accept order" />
          <OrderStatusButton orderId={order.id} targetStatus="cancelled" label="Decline order" variant="secondary" />
        </div>
      )}

      {order.status === "accepted_by_seller" && (
        <OrderStatusButton orderId={order.id} targetStatus="packing" label="Start packing" />
      )}

      {order.status === "packing" && (
        <section>
          <h2 className="font-medium text-field mb-3">Packing evidence</h2>
          <PackingEvidenceUploader orderId={order.id} existingCount={evidenceRows?.length ?? 0} />
        </section>
      )}

      {order.status === "packed" && (
        <OrderStatusButton
          orderId={order.id}
          targetStatus="out_for_delivery"
          label={order.delivery_mode === "pickup" ? "Mark ready for pickup" : "Ready for Pickup (notify delivery partner)"}
        />
      )}

      {order.status === "out_for_delivery" && (
        <p className="text-soil/70 text-sm">
          {order.delivery_mode === "pickup"
            ? "Waiting for the buyer to come collect and confirm pickup."
            : "Visible to Kissaan Saathi delivery partners now — waiting for one to accept and pick it up."}
        </p>
      )}

      {order.payment_method === "cod" && order.payment_status === "cod_pending" &&
        ["out_for_delivery", "delivered", "completed"].includes(order.status) && (
          <CodCollectButton orderId={order.id} />
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
        </section>
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
    </div>
  );
}
