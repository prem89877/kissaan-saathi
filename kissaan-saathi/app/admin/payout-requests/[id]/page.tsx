import { createClient } from "@/lib/supabase/server";
import FulfillPayoutRequestForm from "@/components/FulfillPayoutRequestForm";
import Link from "next/link";

export default async function AdminPayoutRequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: req } = await supabase
    .from("farmer_payout_requests")
    .select("id, farmer_id, source, order_ids, eligible_amount, bonus_amount, total_amount, processing_until, status, created_at")
    .eq("id", params.id)
    .single();

  if (!req) return <p className="text-soil/70">Request not found.</p>;

  const [{ data: profile }, { data: farmerProfile }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", req.farmer_id).single(),
    supabase.from("farmer_profiles").select("upi_id, upi_holder_name, farm_name").eq("user_id", req.farmer_id).single(),
    supabase
      .from("orders")
      .select("id, product_subtotal, seller_fee, seller_payout, product_listings(name)")
      .in("id", req.order_ids),
  ]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/admin/payout-requests" className="text-field underline text-sm">← Back to withdrawals</Link>

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
          {req.source === "auto_day16" ? "Auto-settled — awaiting payment" : "Withdrawal requested"}
        </h2>
        <div className="flex flex-col gap-1 text-soil/90">
          <div className="flex justify-between"><span>Eligible amount</span><span>₹{Number(req.eligible_amount).toFixed(2)}</span></div>
          {Number(req.bonus_amount) > 0 && (
            <div className="flex justify-between"><span>Auto-settlement bonus (2%)</span><span>+ ₹{Number(req.bonus_amount).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-medium text-field border-t border-soil/10 pt-2 mt-1">
            <span>Total payable</span><span>₹{Number(req.total_amount).toFixed(2)}</span>
          </div>
        </div>
        <p className="text-soil/60 text-xs mt-2">Pay by {new Date(req.processing_until).toLocaleDateString()}</p>
      </section>

      <section>
        <h2 className="font-medium text-field mb-2">Orders included ({req.order_ids.length})</h2>
        <div className="flex flex-col gap-2">
          {orders?.map((o: any) => (
            <div key={o.id} className="card">
              <p className="text-sm text-soil">{o.product_listings?.name}</p>
              <p className="text-soil/60 text-xs">₹{o.product_subtotal} − ₹{o.seller_fee} fee = ₹{o.seller_payout}</p>
            </div>
          ))}
        </div>
      </section>

      {req.status === "processing" ? (
        <FulfillPayoutRequestForm requestId={req.id} />
      ) : (
        <p className="text-soil/70">This request has already been paid.</p>
      )}
    </div>
  );
}
