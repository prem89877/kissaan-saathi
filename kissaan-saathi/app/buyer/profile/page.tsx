import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";

export default async function BuyerProfilePage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();
  // Independent of each other — fetch in parallel.
  const [{ data: profile }, { data: buyer }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, email").eq("id", userId).single(),
    supabase.from("buyer_profiles").select("business_name, business_type, address").eq("user_id", userId).single(),
  ]);

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
