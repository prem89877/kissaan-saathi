import { createClient } from "@/lib/supabase/server";
import BuyerDefaultLocationForm from "@/components/BuyerDefaultLocationForm";

export default async function BuyerProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles").select("full_name, phone, email").eq("id", user!.id).single();
  const { data: buyer } = await supabase
    .from("buyer_profiles").select("business_name, business_type, address, lat, lng").eq("user_id", user!.id).single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-field mb-6">Profile</h1>
        <div className="card flex flex-col gap-2">
          <p><span className="text-soil/60">Contact:</span> {profile?.full_name}</p>
          <p><span className="text-soil/60">Phone:</span> {profile?.phone}</p>
          <p><span className="text-soil/60">Email:</span> {profile?.email}</p>
          <p><span className="text-soil/60">Business:</span> {buyer?.business_name}</p>
          <p><span className="text-soil/60">Type:</span> {buyer?.business_type}</p>
        </div>
      </div>

      {/* NEW: buyer can update the default location every order delivers to. */}
      <BuyerDefaultLocationForm
        initial={{
          latitude: buyer?.lat ?? null,
          longitude: buyer?.lng ?? null,
          address: buyer?.address ?? "",
        }}
      />
    </div>
  );
}
