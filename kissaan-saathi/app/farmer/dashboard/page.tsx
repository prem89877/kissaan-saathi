import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function FarmerDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const [
    { count: activeListings },
    { count: pendingListings },
    { count: newOrders },
    { count: completedOrders },
    { count: activeNegotiations },
    { data: pendingSettlementOrders },
  ] = await Promise.all([
    supabase.from("product_listings").select("id", { count: "exact", head: true }).eq("farmer_id", user!.id).eq("status", "approved"),
    supabase.from("product_listings").select("id", { count: "exact", head: true }).eq("farmer_id", user!.id).eq("status", "pending_review"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("farmer_id", user!.id).in("status", ["order_placed", "accepted_by_seller"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("farmer_id", user!.id).eq("status", "completed"),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("farmer_id", user!.id),
    supabase.from("orders").select("seller_payout").eq("farmer_id", user!.id).in("status", ["delivered", "completed"]).is("settlement_id", null),
  ]);
  
  const pendingBalance = (pendingSettlementOrders ?? []).reduce((sum, o) => sum + Number(o.seller_payout), 0);
  
  // New Orders list — a buyer's pending "Buy" request, before this farmer
  // has accepted/rejected/countered it. Only the *latest* offer in each
  // conversation counts here — an older accepted offer from an already
  // completed order shouldn't be mistaken for a new one.
  const { data: allConversations } = await supabase
    .from("conversations")
    .select("id, listing_id, buyer_id")
    .eq("farmer_id", user!.id);
  
  const conversationIds = (allConversations ?? []).map((c) => c.id);
  
  const { data: allOffers } = conversationIds.length ?
    await supabase
    .from("offers")
    .select("id, conversation_id, made_by, status, quantity, price_per_kg, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false }) :
    { data: [] as any[] };
  
  const latestOfferByConversation = new Map < string,
    any > ();
  for (const o of allOffers ?? []) {
    if (!latestOfferByConversation.has(o.conversation_id)) latestOfferByConversation.set(o.conversation_id, o);
  }
  const newOrderOffers = Array.from(latestOfferByConversation.values()).filter(
    (o) => o.status === "pending" && o.made_by === "buyer"
  );
  
  const conversationById = new Map((allConversations ?? []).map((c) => [c.id, c]));
  const newOrderListingIds = Array.from(
    new Set(newOrderOffers.map((o) => conversationById.get(o.conversation_id)?.listing_id).filter(Boolean))
  );
  const newOrderBuyerIds = Array.from(
    new Set(newOrderOffers.map((o) => conversationById.get(o.conversation_id)?.buyer_id).filter(Boolean))
  );
  
  const [{ data: newOrderListings }, { data: newOrderBuyers }] = await Promise.all([
    newOrderListingIds.length ?
    supabase.from("product_listings").select("id, name").in("id", newOrderListingIds) :
    Promise.resolve({ data: [] as { id: string;name: string } [] }),
    newOrderBuyerIds.length ?
    supabase.from("buyer_profiles").select("user_id, business_name").in("user_id", newOrderBuyerIds) :
    Promise.resolve({ data: [] as { user_id: string;business_name: string } [] }),
  ]);
  const newOrderListingNameById = new Map((newOrderListings ?? []).map((l) => [l.id, l.name]));
  const newOrderBuyerNameById = new Map((newOrderBuyers ?? []).map((b) => [b.user_id, b.business_name]));
  
  const cards = [
    { label: "Active listings", value: activeListings ?? 0 },
    { label: "Pending approval", value: pendingListings ?? 0 },
    { label: "Active negotiations", value: activeNegotiations ?? 0 },
    { label: "New orders", value: newOrders ?? 0 },
    { label: "Completed orders", value: completedOrders ?? 0 },
  ];
  
  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-3xl font-display text-field">{c.value}</p>
            <p className="text-sm text-soil/70">{c.label}</p>
          </div>
        ))}
      </div>

      {newOrderOffers.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display text-lg text-field mb-3">New Orders</h2>
          <div className="flex flex-col gap-3">
            {newOrderOffers.map((o) => {
              const conv = conversationById.get(o.conversation_id);
              return (
                <Link key={o.id} href={`/farmer/orders/pending/${o.id}`} className="card border-field block">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-soil">
                      {conv ? newOrderListingNameById.get(conv.listing_id) ?? "Listing" : "Listing"}
                    </p>
                    <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
                      New — needs your response
                    </span>
                  </div>
                  <p className="text-soil/70 text-sm mt-1">
                    {o.quantity} kg @ ₹{o.price_per_kg}/kg · from{" "}
                    {conv ? newOrderBuyerNameById.get(conv.buyer_id) ?? "a buyer" : "a buyer"}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <Link href="/farmer/earnings" className="card border-field block mb-6">
        <p className="text-sm text-soil/70">Pending settlement balance</p>
        <p className="text-2xl font-display text-field">₹{pendingBalance.toFixed(2)}</p>
        <p className="text-soil/50 text-xs mt-1">Paid every Saturday via UPI · tap to view history</p>
      </Link>

      <Link href="/farmer/listings/new" className="btn-primary block text-center">
        + Add a new listing
      </Link>
    </div>
  );
}