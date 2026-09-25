import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import FarmerUpiForm from "@/components/FarmerUpiForm";
import Link from "next/link";

export default async function FarmerProfilePage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();
  // Independent of each other — fetch in parallel.
  const [{ data: profile }, { data: farmer }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, email").eq("id", userId).single(),
    supabase
      .from("farmer_profiles")
      .select("farm_name, area, address, upi_id, upi_holder_name")
      .eq("user_id", userId)
      .single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
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

      <FarmerUpiForm initialUpiId={farmer?.upi_id ?? null} initialHolderName={farmer?.upi_holder_name ?? null} />

      <Link href="/farmer/earnings" className="btn-secondary text-center">
        View earnings &amp; settlement history
      </Link>
    </div>
  );
}
