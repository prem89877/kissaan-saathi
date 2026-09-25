import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminDeliverySettlementsPage() {
  const supabase = createClient();

  const { data: eligibleOrders } = await supabase
    .from("orders")
    .select("delivery_partner_id, delivery_cost, delivery_partner_earning")
    .eq("delivery_mode", "delivery")
    .in("status", ["delivered", "completed"])
    .is("delivery_settlement_id", null)
    .not("delivery_partner_id", "is", null);

  const byPartner = new Map<string, { count: number; net: number }>();
  for (const o of eligibleOrders ?? []) {
    const id = o.delivery_partner_id as string;
    const entry = byPartner.get(id) ?? { count: 0, net: 0 };
    entry.count += 1;
    // Falls back to delivery_cost for any order settled before
    // delivery_partner_earning was backfilled.
    entry.net += Number(o.delivery_partner_earning ?? o.delivery_cost);
    byPartner.set(id, entry);
  }

  const partnerIds = Array.from(byPartner.keys());
  const [{ data: profiles }, { data: deliveryProfiles }] = await Promise.all([
    partnerIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", partnerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    partnerIds.length
      ? supabase.from("delivery_profiles").select("user_id, upi_id").in("user_id", partnerIds)
      : Promise.resolve({ data: [] as { user_id: string; upi_id: string | null }[] }),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const upiById = new Map((deliveryProfiles ?? []).map((d) => [d.user_id, d.upi_id]));

  const { data: recentSettlements } = await supabase
    .from("delivery_settlements")
    .select("id, delivery_partner_id, amount_paid, utr_reference, payment_date, status")
    .order("created_at", { ascending: false })
    .limit(20);

  const recentNameById = new Map<string, string>();
  if (recentSettlements && recentSettlements.length > 0) {
    const ids = Array.from(new Set(recentSettlements.map((s) => s.delivery_partner_id)));
    const { data: names } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const n of names ?? []) recentNameById.set(n.id, n.full_name);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl text-field">Delivery Settlements</h1>
          <Link href="/admin/settlements" className="text-field underline text-sm">Farmer settlements →</Link>
        </div>
        <p className="text-soil/60 text-sm mb-4">Paid out weekly, every Sunday, via UPI.</p>

        {byPartner.size === 0 && <p className="text-soil/70">No pending settlements right now.</p>}

        <div className="flex flex-col gap-3">
          {Array.from(byPartner.entries()).map(([partnerId, agg]) => (
            <Link key={partnerId} href={`/admin/delivery-settlements/${partnerId}`} className="card block">
              <div className="flex justify-between items-start">
                <p className="font-medium text-soil">{nameById.get(partnerId) ?? "Delivery Partner"}</p>
                <span className="text-xs bg-marigold/20 text-marigold-dark rounded-full px-2 py-1">Pending</span>
              </div>
              <p className="text-soil/60 text-xs mt-1">UPI: {upiById.get(partnerId) || "not set"}</p>
              <p className="text-soil/70 text-sm mt-1">
                {agg.count} order{agg.count === 1 ? "" : "s"} delivered
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
                <p className="font-medium text-soil">{recentNameById.get(s.delivery_partner_id) ?? "Delivery Partner"}</p>
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
