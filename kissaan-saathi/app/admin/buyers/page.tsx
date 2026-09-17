import { createClient } from "@/lib/supabase/server";
import SuspendToggleButton from "@/components/SuspendToggleButton";

export default async function AdminBuyersPage() {
  const supabase = createClient();
  const { data: buyers } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, is_suspended, buyer_profiles(business_name, business_type)")
    .eq("role", "buyer")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Buyers</h1>
      <div className="flex flex-col gap-3">
        {buyers?.map((b: any) => (
          <div key={b.id} className="card flex justify-between items-start gap-3">
            <div>
              <p className="font-medium text-soil">{b.buyer_profiles?.business_name ?? b.full_name}</p>
              <p className="text-soil/60 text-sm">{b.phone} · {b.email}</p>
              <p className="text-soil/60 text-sm">{b.buyer_profiles?.business_type}</p>
              {b.is_suspended && <p className="text-alert text-xs mt-1">Suspended</p>}
            </div>
            <SuspendToggleButton userId={b.id} isSuspended={b.is_suspended} />
          </div>
        ))}
      </div>
    </div>
  );
}
