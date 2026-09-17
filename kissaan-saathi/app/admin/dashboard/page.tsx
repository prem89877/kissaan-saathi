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
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "farmer"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "buyer"),
    supabase.from("product_listings").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("product_listings").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

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
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-3xl font-display text-field">{c.value}</p>
            <p className="text-sm text-soil/70">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
