import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminPayoutRequestsPage() {
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("farmer_payout_requests")
    .select("id, farmer_id, source, eligible_amount, bonus_amount, total_amount, processing_until, created_at")
    .eq("status", "processing")
    .order("processing_until", { ascending: true });

  const farmerIds = Array.from(new Set((requests ?? []).map((r) => r.farmer_id)));
  const [{ data: profiles }, { data: farmerProfiles }] = await Promise.all([
    farmerIds.length
      ? supabase.from("profiles").select("id, full_name, phone").in("id", farmerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; phone: string }[] }),
    farmerIds.length
      ? supabase.from("farmer_profiles").select("user_id, upi_id").in("user_id", farmerIds)
      : Promise.resolve({ data: [] as { user_id: string; upi_id: string | null }[] }),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const phoneById = new Map((profiles ?? []).map((p) => [p.id, p.phone]));
  const upiById = new Map((farmerProfiles ?? []).map((f) => [f.user_id, f.upi_id]));

  const now = Date.now();

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-field">Farmer Withdrawals</h1>
        <Link href="/admin/settlements" className="text-field underline text-sm">Bulk settlements →</Link>
      </div>
      <p className="text-soil/60 text-sm -mt-4">
        Farmer-initiated withdrawals (pay within 3 days) and day-16 auto-settlements (include a 2% bonus already
        added to the total below).
      </p>

      {(!requests || requests.length === 0) && <p className="text-soil/70">No pending withdrawal requests.</p>}

      <div className="flex flex-col gap-3">
        {requests?.map((r) => {
          const overdue = new Date(r.processing_until).getTime() < now;
          return (
            <Link key={r.id} href={`/admin/payout-requests/${r.id}`} className="card block">
              <div className="flex justify-between items-start">
                <p className="font-medium text-soil">{nameById.get(r.farmer_id) ?? "Farmer"}</p>
                <span
                  className={`text-xs rounded-full px-2 py-1 ${
                    overdue ? "bg-alert/20 text-alert" : "bg-marigold/20 text-marigold-dark"
                  }`}
                >
                  {r.source === "auto_day16" ? "Auto-settled (2% bonus)" : "Withdrawal"}
                  {overdue ? " — overdue" : ""}
                </span>
              </div>
              <p className="text-soil/60 text-xs mt-1">
                UPI: {upiById.get(r.farmer_id) || "not set"} · {phoneById.get(r.farmer_id)}
              </p>
              <p className="font-medium text-field mt-1">₹{Number(r.total_amount).toFixed(2)}</p>
              <p className="text-soil/60 text-xs">
                Pay by {new Date(r.processing_until).toLocaleDateString()}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
