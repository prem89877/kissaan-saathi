import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = createClient();

  const [
    { count: totalFarmers },
    { count: totalBuyers },
    { count: activeListings },
    { count: pendingListings },
    { count: totalOrders },
    { count: openDisputes },
    { data: pendingSettlementOrders },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "farmer"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "buyer"),
    supabase.from("product_listings").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("product_listings").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("orders").select("seller_payout").in("status", ["delivered", "completed"]).is("settlement_id", null),
  ]);

  const pendingPayout = (pendingSettlementOrders ?? []).reduce((sum, o) => sum + Number(o.seller_payout), 0);

  const cards = [
    { label: "Total farmers", value: totalFarmers ?? 0 },
    { label: "Total buyers", value: totalBuyers ?? 0 },
    { label: "Active listings", value: activeListings ?? 0 },
    { label: "Pending review", value: pendingListings ?? 0 },
    { label: "Total orders", value: totalOrders ?? 0 },
    { label: "Open disputes", value: openDisputes ?? 0 },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Admin dashboard</h1>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-3xl font-display text-field">{c.value}</p>
            <p className="text-sm text-soil/70">{c.label}</p>
          </div>
        ))}
      </div>

      <Link href="/admin/settlements" className="card border-marigold block mb-4">
        <p className="text-sm text-soil/70">Pending farmer payouts (all farmers)</p>
        <p className="text-2xl font-display text-marigold-dark">₹{pendingPayout.toFixed(2)}</p>
      </Link>

      <div className="flex gap-2">
        <Link href="/admin/farmers" className="btn-secondary flex-1 text-center">Farmers</Link>
        <Link href="/admin/buyers" className="btn-secondary flex-1 text-center">Buyers</Link>
      </div>
    </div>
  );
}
