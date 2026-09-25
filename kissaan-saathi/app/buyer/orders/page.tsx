import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

const STATUS_LABEL: Record < string, string > = {
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
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  // These two are independent of each other — fetch in parallel.
  // Declined requests — a farmer's reject on a buy request never becomes a
  // row in "orders", so it has to be surfaced here from "offers" instead.
  // Only the *latest* offer in each conversation counts, so an old rejected
  // offer from a conversation that later succeeded doesn't show up again.
  const [{ data: orders }, { data: conversations }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, quantity, price_per_kg, buyer_total, status, listing_id, product_listings(name)")
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("conversations").select("id, listing_id").eq("buyer_id", userId),
  ]);
  
  const conversationIds = (conversations ?? []).map((c) => c.id);
  
  const { data: allOffers } = conversationIds.length ?
    await supabase
    .from("offers")
    .select("id, conversation_id, status, quantity, price_per_kg, rejection_reason, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false }) :
    { data: [] as any[] };
  
  const latestOfferByConversation = new Map < string,
    any > ();
  for (const o of allOffers ?? []) {
    if (!latestOfferByConversation.has(o.conversation_id)) latestOfferByConversation.set(o.conversation_id, o);
  }
  const rejectedOffers = Array.from(latestOfferByConversation.values()).filter((o) => o.status === "rejected");
  
  const conversationById = new Map((conversations ?? []).map((c) => [c.id, c]));
  const rejectedListingIds = Array.from(
    new Set(rejectedOffers.map((o) => conversationById.get(o.conversation_id)?.listing_id).filter(Boolean))
  );
  const { data: rejectedListings } = rejectedListingIds.length ?
    await supabase.from("product_listings").select("id, name").in("id", rejectedListingIds) :
    { data: [] as { id: string;name: string } [] };
  const rejectedListingNameById = new Map((rejectedListings ?? []).map((l) => [l.id, l.name]));
  
  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Orders</h1>
      {(!orders || orders.length === 0) && rejectedOffers.length === 0 && (
        <p className="text-soil/70">
          No orders yet. Orders are created once you accept a farmer's offer in a negotiation.
        </p>
      )}

      {rejectedOffers.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display text-lg text-field mb-3">Declined requests</h2>
          <div className="flex flex-col gap-3">
            {rejectedOffers.map((o) => {
              const conv = conversationById.get(o.conversation_id);
              return (
                <Link key={o.id} href={`/buyer/chat/${o.conversation_id}`} className="card border-alert block">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-soil">
                      {conv ? rejectedListingNameById.get(conv.listing_id) ?? "Listing" : "Listing"}
                    </p>
                    <span className="text-xs bg-alert/10 text-alert rounded-full px-2 py-1 whitespace-nowrap">
                      Declined by farmer
                    </span>
                  </div>
                  <p className="text-soil/70 text-sm mt-1">
                    {o.quantity} kg @ ₹{o.price_per_kg}/kg
                  </p>
                  {o.rejection_reason && (
                    <p className="text-soil/60 text-xs mt-1">Reason: {o.rejection_reason}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
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