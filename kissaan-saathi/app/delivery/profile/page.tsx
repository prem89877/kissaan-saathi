import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import DeliveryUpiForm from "@/components/DeliveryUpiForm";
import Link from "next/link";

export default async function DeliveryProfilePage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  // Independent of each other — fetch in parallel.
  const [{ data: profile }, { data: deliveryProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, email").eq("id", userId).single(),
    supabase.from("delivery_profiles").select("upi_id, upi_holder_name").eq("user_id", userId).maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-field mb-6">Profile</h1>
        <div className="card flex flex-col gap-2">
          <p><span className="text-soil/60">Name:</span> {profile?.full_name}</p>
          <p><span className="text-soil/60">Phone:</span> {profile?.phone}</p>
          <p><span className="text-soil/60">Email:</span> {profile?.email}</p>
        </div>
      </div>

      <DeliveryUpiForm
        initialUpiId={deliveryProfile?.upi_id ?? null}
        initialHolderName={deliveryProfile?.upi_holder_name ?? null}
      />

      <Link href="/delivery/earnings" className="btn-secondary text-center">
        View earnings &amp; settlement history
      </Link>
    </div>
  );
}
