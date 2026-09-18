import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminSettlementsPage() {
  const supabase = createClient();

  const { data: eligibleOrders } = await supabase
    .from("orders")
    .select("farmer_id, product_subtotal, seller_fee, seller_payout")
    .in("status", ["delivered", "completed"])
    .is("settlement_id", null);

  const byFarmer = new Map<string, { count: number; gross: number; fee: number; net: number }>();
  for (const o of eligibleOrders ?? []) {
    const entry = byFarmer.get(o.farmer_id) ?? { count: 0, gross: 0, fee: 0, net: 0 };
    entry.count += 1;
    entry.gross += Number(o.product_subtotal);
    entry.fee += Number(o.seller_fee);
    entry.net += Number(o.seller_payout);
    byFarmer.set(o.farmer_id, entry);
  }

  const farmerIds = Array.from(byFarmer.keys());
  const [{ data: profiles }, { data: farmerProfiles }] = await Promise.all([
    farmerIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", farmerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    farmerIds.length
      ? supabase.from("farmer_profiles").select("user_id, upi_id").in("user_id", farmerIds)
      : Promise.resolve({ data: [] as { user_id: string; upi_id: string | null }[] }),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const upiById = new Map((farmerProfiles ?? []).map((f) => [f.user_id, f.upi_id]));

  const { data: recentSettlements } = await supabase
    .from("farmer_settlements")
    .select("id, farmer_id, amount_paid, utr_reference, payment_date, status")
    .order("created_at", { ascending: false })
    .limit(20);

  const recentNameById = new Map<string, string>();
  if (recentSettlements && recentSettlements.length > 0) {
    const ids = Array.from(new Set(recentSettlements.map((s) => s.farmer_id)));
    const { data: names } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const n of names ?? []) recentNameById.set(n.id, n.full_name);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl text-field mb-4">Farmer Settlements</h1>

        {byFarmer.size === 0 && <p className="text-soil/70">No pending settlements right now.</p>}

        <div className="flex flex-col gap-3">
          {Array.from(byFarmer.entries()).map(([farmerId, agg]) => (
            <Link key={farmerId} href={`/admin/settlements/${farmerId}`} className="card block">
              <div className="flex justify-between items-start">
                <p className="font-medium text-soil">{nameById.get(farmerId) ?? "Farmer"}</p>
                <span className="text-xs bg-marigold/20 text-marigold-dark rounded-full px-2 py-1">Pending</span>
              </div>
              <p className="text-soil/60 text-xs mt-1">UPI: {upiById.get(farmerId) || "not set"}</p>
              <p className="text-soil/70 text-sm mt-1">
                {agg.count} order{agg.count === 1 ? "" : "s"} · Gross ₹{agg.gross.toFixed(2)} · Fee ₹{agg.fee.toFixed(2)}
              </p>
              <p className="font-medium text-field mt-1">Payable ₹{agg.net.toFixed(2)}</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-medium text-field mb-3">Recent settlements</h2>
        {(!recentSettlements || recentSettlements.length === 0) && (
          <p className="text-soil/70">No settlements recorded yet.</p>
        )}
        <div className="flex flex-col gap-3">
          {recentSettlements?.map((s) => (
            <div key={s.id} className="card">
              <div className="flex justify-between items-start">
                <p className="font-medium text-soil">{recentNameById.get(s.farmer_id) ?? "Farmer"}</p>
                <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1">{s.status}</span>
              </div>
              <p className="text-soil/70 text-sm mt-1">₹{s.amount_paid} · {s.payment_date}</p>
              <p className="text-soil/60 text-xs">UTR: {s.utr_reference}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
