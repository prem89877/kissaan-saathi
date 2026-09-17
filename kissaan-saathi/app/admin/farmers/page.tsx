import { createClient } from "@/lib/supabase/server";
import SuspendToggleButton from "@/components/SuspendToggleButton";

export default async function AdminFarmersPage() {
  const supabase = createClient();
  const { data: farmers } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, is_suspended, farmer_profiles(farm_name, area)")
    .eq("role", "farmer")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Farmers</h1>
      <div className="flex flex-col gap-3">
        {farmers?.map((f: any) => (
          <div key={f.id} className="card flex justify-between items-start gap-3">
            <div>
              <p className="font-medium text-soil">{f.full_name}</p>
              <p className="text-soil/60 text-sm">{f.phone} · {f.email}</p>
              <p className="text-soil/60 text-sm">{f.farmer_profiles?.farm_name} — {f.farmer_profiles?.area}</p>
              {f.is_suspended && <p className="text-alert text-xs mt-1">Suspended</p>}
            </div>
            <SuspendToggleButton userId={f.id} isSuspended={f.is_suspended} />
          </div>
        ))}
      </div>
    </div>
  );
}
