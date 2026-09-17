import { createClient } from "@/lib/supabase/server";

export default async function FarmerProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", user!.id)
    .single();
  const { data: farmer } = await supabase
    .from("farmer_profiles")
    .select("farm_name, area, address")
    .eq("user_id", user!.id)
    .single();

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Profile</h1>
      <div className="card flex flex-col gap-2">
        <p><span className="text-soil/60">Name:</span> {profile?.full_name}</p>
        <p><span className="text-soil/60">Phone:</span> {profile?.phone}</p>
        <p><span className="text-soil/60">Email:</span> {profile?.email}</p>
        <p><span className="text-soil/60">Farm:</span> {farmer?.farm_name || "—"}</p>
        <p><span className="text-soil/60">Area:</span> {farmer?.area || "—"}</p>
        <p><span className="text-soil/60">Address:</span> {farmer?.address || "—"}</p>
      </div>
    </div>
  );
}
