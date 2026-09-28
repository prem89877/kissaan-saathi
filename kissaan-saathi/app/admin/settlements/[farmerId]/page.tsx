import { createClient } from "@/lib/supabase/server";
import SettlementForm from "@/components/SettlementForm";
import Link from "next/link";

export default async function AdminSettlementDetailPage({ params }: { params: { farmerId: string } }) {
  const supabase = createClient();

  const [{ data: profile }, { data: farmerProfile }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", params.farmerId).single(),
    supabase.from("farmer_profiles").select("upi_id, upi_holder_name, farm_name").eq("user_id", params.farmerId).single(),
    supabase
      .from("orders")
      .select("id, product_subtotal, seller_fee, seller_payout, status, payment_method, cod_cash_deposits(status), product_listings(name)")
      .eq("farmer_id", params.farmerId)
      .in("status", ["delivered", "completed"])
      .is("settlement_id", null)
      // Exclude orders already claimed by a pending withdrawal/auto-settlement
      // request — see 19_farmer_withdrawal_and_auto_settlement.sql and the note
      // on the /admin/settlements list page.
      .is("payout_request_id", null)
      .order("created_at", { ascending: true }),
  ]);

  // COD cash must be deposited AND confirmed by Admin before it counts
  // toward a farmer's payable balance — see
  // 22_link_cod_deposit_to_farmer_settlement.sql.
  const eligibleOrders = (orders ?? []).filter((o: any) => {
    if (o.payment_method !== "cod") return true;
    const depositStatus = Array.isArray(o.cod_cash_deposits) ? o.cod_cash_deposits[0]?.status : o.cod_cash_deposits?.status;
    return depositStatus === "confirmed";
  });

  const gross = eligibleOrders.reduce((sum, o) => sum + Number(o.product_subtotal), 0);
  const fee = eligibleOrders.reduce((sum, o) => sum + Number(o.seller_fee), 0);
  const net = eligibleOrders.reduce((sum, o) => sum + Number(o.seller_payout), 0);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/admin/settlements" className="text-field underline text-sm">← Back to settlements</Link>

      <div>
        <h1 className="font-display text-2xl text-field">{profile?.full_name}</h1>
        <p className="text-soil/60 text-sm">{farmerProfile?.farm_name} · {profile?.phone}</p>
      </div>

      <section className="card">
        <h2 className="font-medium text-field mb-2">UPI details</h2>
        <p>{farmerProfile?.upi_id || "Not set — ask the farmer to add this in their profile."}</p>
        <p className="text-soil/60 text-sm">{farmerProfile?.upi_holder_name}</p>
      </section>

      <section className="card border-field">
        <h2 className="font-medium text-field mb-2">
          {eligibleOrders.length} order{eligibleOrders.length === 1 ? "" : "s"} pending settlement
        </h2>
        <div className="flex flex-col gap-1 text-soil/90">
          <div className="flex justify-between"><span>Gross product amount</span><span>₹{gross.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>5% seller fee</span><span>− ₹{fee.toFixed(2)}</span></div>
          <div className="flex justify-between font-medium text-field border-t border-soil/10 pt-2 mt-1">
            <span>Net payable</span><span>₹{net.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {(orders?.length ?? 0) > eligibleOrders.length && (
        <p className="text-soil/60 text-sm -mt-4">
          {(orders?.length ?? 0) - eligibleOrders.length} more delivered COD order(s) are excluded until their cash
          deposit is confirmed — see <Link href="/admin/cod-deposits" className="underline">COD deposits</Link>.
        </p>
      )}

      <section>
        <h2 className="font-medium text-field mb-2">Orders included</h2>
        <div className="flex flex-col gap-2">
          {eligibleOrders.map((o: any) => (
            <div key={o.id} className="card">
              <p className="text-sm text-soil">{o.product_listings?.name}</p>
              <p className="text-soil/60 text-xs">₹{o.product_subtotal} − ₹{o.seller_fee} fee = ₹{o.seller_payout}</p>
            </div>
          ))}
        </div>
      </section>

      {net > 0 ? (
        <SettlementForm farmerId={params.farmerId} suggestedAmount={net} />
      ) : (
        <p className="text-soil/70">Nothing pending for this farmer.</p>
      )}
    </div>
  );
}
