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
