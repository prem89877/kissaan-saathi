import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

export default async function BuyerDashboard() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  const [{ count: activeOrders }, { count: completedOrders }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", userId).not("status", "in", "(completed,cancelled)"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", userId).eq("status", "completed"),
  ]);

  const { count: approvedListings } = await supabase
    .from("product_listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="card">
          <p className="text-3xl font-display text-field">{activeOrders ?? 0}</p>
          <p className="text-sm text-soil/70">Active orders</p>
        </div>
        <div className="card">
          <p className="text-3xl font-display text-field">{completedOrders ?? 0}</p>
          <p className="text-sm text-soil/70">Completed orders</p>
        </div>
      </div>
      <Link href="/buyer/marketplace" className="btn-primary block text-center">
        Browse {approvedListings ?? 0} available listings
      </Link>
    </div>
  );
}
