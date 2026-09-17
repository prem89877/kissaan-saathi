import { createClient } from "@/lib/supabase/server";

export default async function BuyerProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles").select("full_name, phone, email").eq("id", user!.id).single();
  const { data: buyer } = await supabase
    .from("buyer_profiles").select("business_name, business_type, address").eq("user_id", user!.id).single();

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Profile</h1>
      <div className="card flex flex-col gap-2">
        <p><span className="text-soil/60">Contact:</span> {profile?.full_name}</p>
        <p><span className="text-soil/60">Phone:</span> {profile?.phone}</p>
        <p><span className="text-soil/60">Email:</span> {profile?.email}</p>
        <p><span className="text-soil/60">Business:</span> {buyer?.business_name}</p>
        <p><span className="text-soil/60">Type:</span> {buyer?.business_type}</p>
        <p><span className="text-soil/60">Address:</span> {buyer?.address}</p>
      </div>
    </div>
  );
}
