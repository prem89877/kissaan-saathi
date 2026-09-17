import { createClient } from "@/lib/supabase/server";
import AdminListingActions from "@/components/AdminListingActions";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  suspended: "Suspended",
};

export default async function AdminListingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: listing } = await supabase
    .from("product_listings")
    .select(
      "id, name, price_per_kg, available_qty, moq, grade, quality_description, harvest_date, shelf_life_days, delivery_radius_km, delivery_cost_estimate, status, admin_reviewed, rejection_reason, farmer_id, categories(name)"
    )
    .eq("id", params.id)
    .single();

  if (!listing) {
    return <p className="text-soil/70">Listing not found.</p>;
  }

  const [{ data: images }, { data: farmerProfile }, { data: farmer }] = await Promise.all([
    supabase.from("product_images").select("storage_path").eq("listing_id", listing.id),
    supabase.from("profiles").select("full_name, phone, email").eq("id", listing.farmer_id).single(),
    supabase.from("farmer_profiles").select("farm_name, area, address").eq("user_id", listing.farmer_id).single(),
  ]);

  const photoUrls = (images ?? []).map(
    (img) => supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <Link href="/admin/listings" className="text-field underline text-sm">← Back to listings</Link>
      </div>

      <div>
        <div className="flex justify-between items-start">
          <h1 className="font-display text-2xl text-field">{listing.name}</h1>
          <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1 whitespace-nowrap">
            {STATUS_LABEL[listing.status] ?? listing.status}
          </span>
        </div>
        {/* @ts-expect-error - categories relation typed loosely for MVP */}
        <p className="text-soil/60 text-sm">{listing.categories?.name}</p>
      </div>

      <section className="card">
        <h2 className="font-medium text-field mb-2">Pricing &amp; quantity</h2>
        <p>₹{listing.price_per_kg}/kg</p>
        <p>{listing.available_qty} kg available · MOQ {listing.moq} kg</p>
      </section>

      <section className="card">
        <h2 className="font-medium text-field mb-2">Quality</h2>
        <p>Grade: {listing.grade || "—"}</p>
        <p className="text-soil/80 mt-1">{listing.quality_description || "No description provided."}</p>
      </section>

      <section className="card">
        <h2 className="font-medium text-field mb-2">Harvest &amp; shelf life</h2>
        <p>Harvested: {listing.harvest_date || "—"}</p>
        <p>Shelf life: {listing.shelf_life_days ? `${listing.shelf_life_days} days` : "—"}</p>
      </section>

      <section className="card">
        <h2 className="font-medium text-field mb-2">Delivery</h2>
        <p>Radius: {listing.delivery_radius_km ? `${listing.delivery_radius_km} km` : "—"}</p>
        <p>Estimated cost: {listing.delivery_cost_estimate ? `₹${listing.delivery_cost_estimate}` : "—"}</p>
      </section>

      <section className="card">
        <h2 className="font-medium text-field mb-2">Farmer</h2>
        <p>{farmerProfile?.full_name}</p>
        <p className="text-soil/70 text-sm">{farmerProfile?.phone} · {farmerProfile?.email}</p>
        <p className="text-soil/70 text-sm mt-1">{farmer?.farm_name}</p>
        <p className="text-soil/70 text-sm">{farmer?.area} — {farmer?.address}</p>
      </section>

      <section>
        <h2 className="font-medium text-field mb-2">
          Photos ({photoUrls.length}{photoUrls.length < 10 ? " — below the 10-photo minimum" : ""})
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {photoUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="w-full aspect-square object-cover rounded-card" />
          ))}
        </div>
        {photoUrls.length === 0 && <p className="text-soil/60 text-sm">No photos uploaded.</p>}
      </section>

      {listing.rejection_reason && (
        <section className="card border-alert">
          <h2 className="font-medium text-alert mb-1">Last reason given</h2>
          <p className="text-soil/80">{listing.rejection_reason}</p>
        </section>
      )}

      <section>
        <h2 className="font-medium text-field mb-3">Admin action</h2>
        <AdminListingActions listingId={listing.id} photoCount={photoUrls.length} />
      </section>
    </div>
  );
}
