import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  suspended: "Suspended",
};

export default async function FarmerListingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: listings } = await supabase
    .from("product_listings")
    .select("id, name, price_per_kg, available_qty, status, admin_reviewed, rejection_reason, product_images(storage_path)")
    .eq("farmer_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-field">My listings</h1>
        <Link href="/farmer/listings/new" className="text-field underline text-sm">+ Add</Link>
      </div>

      {(!listings || listings.length === 0) && (
        <p className="text-soil/70">You haven't listed any produce yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {listings?.map((l) => {
          const firstImagePath = l.product_images?.[0]?.storage_path;
          const thumbUrl = firstImagePath
            ? supabase.storage.from("product-images").getPublicUrl(firstImagePath).data.publicUrl
            : null;

          return (
            <div key={l.id} className="card flex gap-3">
              {thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt="" className="w-16 h-16 object-cover rounded-card flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-soil">{l.name}</p>
                  <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                </div>
                <p className="text-soil/70 text-sm mt-1">
                  ₹{l.price_per_kg}/kg · {l.available_qty} kg available
                </p>
                {l.admin_reviewed && (
                  <p className="text-marigold-dark text-xs mt-1">Admin Reviewed</p>
                )}
                {l.rejection_reason && (
                  <p className="text-alert text-xs mt-1">Reason: {l.rejection_reason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
