import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

export default async function DeliveryEarningsPage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  const [{ data: pendingOrders }, { data: settlements }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, delivery_cost, delivery_partner_earning")
      .eq("delivery_partner_id", userId)
      .eq("delivery_mode", "delivery")
      .in("status", ["delivered", "completed"])
      .is("delivery_settlement_id", null),
    supabase
      .from("delivery_settlements")
      .select("id, gross_amount, net_payable, amount_paid, utr_reference, payment_date, status, created_at")
      .eq("delivery_partner_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const pendingCount = pendingOrders?.length ?? 0;
  const pendingNet = (pendingOrders ?? []).reduce(
    (sum, o) => sum + Number(o.delivery_partner_earning ?? o.delivery_cost),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-field mb-1">Earnings</h1>
        <p className="text-soil/60 text-sm">Paid out weekly, every Sunday, directly to your UPI ID.</p>
      </div>

      <section className="card border-field">
        <h2 className="font-medium text-field mb-2">Pending settlement balance</h2>
        <p className="text-3xl font-display text-field">₹{pendingNet.toFixed(2)}</p>
        <p className="text-soil/60 text-sm mt-1">
          From {pendingCount} delivered order{pendingCount === 1 ? "" : "s"} not yet paid out.
        </p>
      </section>

      <section>
        <h2 className="font-medium text-field mb-3">Settlement history</h2>
        {(!settlements || settlements.length === 0) && (
          <p className="text-soil/70">No settlements yet.</p>
        )}
        <div className="flex flex-col gap-3">
          {settlements?.map((s) => (
            <div key={s.id} className="card">
              <div className="flex justify-between items-start">
                <p className="font-medium text-soil">₹{s.amount_paid}</p>
                <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1">{s.status}</span>
              </div>
              <p className="text-soil/70 text-sm mt-1">Paid on {s.payment_date}</p>
              <p className="text-soil/60 text-xs mt-1">UTR: {s.utr_reference}</p>
              <p className="text-soil/60 text-xs">Net ₹{s.net_payable}</p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/delivery/profile" className="text-field underline text-sm">← Back to profile</Link>
    </div>
  );
}
