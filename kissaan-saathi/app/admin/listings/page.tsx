import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  suspended: "Suspended",
};

const TABS = [
  { value: "pending_review", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = searchParams.status || "pending_review";
  const supabase = createClient();

  const { data: listings } = await supabase
    .from("product_listings")
    .select("id, name, price_per_kg, available_qty, status, product_images(storage_path)")
    .eq("status", status)
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-4">Listings</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/listings?status=${tab.value}`}
            className={`text-sm px-3 py-2 rounded-full whitespace-nowrap ${
              status === tab.value ? "bg-field text-sand" : "bg-field/10 text-field"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {(!listings || listings.length === 0) && (
        <p className="text-soil/70">Nothing here right now.</p>
      )}

      <div className="flex flex-col gap-3">
        {listings?.map((l) => {
          const firstImagePath = l.product_images?.[0]?.storage_path;
          const thumbUrl = firstImagePath
            ? supabase.storage.from("product-images").getPublicUrl(firstImagePath).data.publicUrl
            : null;

          return (
            <Link key={l.id} href={`/admin/listings/${l.id}`} className="card flex gap-3">
              {thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt="" className="w-16 h-16 object-cover rounded-card flex-shrink-0" />
              )}
              <div>
                <p className="font-medium text-soil">{l.name}</p>
                <p className="text-soil/70 text-sm mt-1">
                  ₹{l.price_per_kg}/kg · {l.available_qty} kg · {l.product_images?.length ?? 0} photos
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
