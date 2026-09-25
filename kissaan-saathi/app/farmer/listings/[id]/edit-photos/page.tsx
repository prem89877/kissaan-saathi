import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import AddPhotosToListing from "@/components/AddPhotosToListing";
import Link from "next/link";

export default async function EditListingPhotosPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  const { data: listing } = await supabase
    .from("product_listings")
    .select("id, name, farmer_id")
    .eq("id", params.id)
    .single();

  if (!listing || listing.farmer_id !== userId) {
    return <p className="text-soil/70">Listing not found.</p>;
  }

  const { data: images } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("listing_id", listing.id);

  const photoUrls = (images ?? []).map(
    (img) => supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/farmer/listings" className="text-field underline text-sm">← Back to listings</Link>
      <h1 className="font-display text-2xl text-field">{listing.name}</h1>

      <AddPhotosToListing listingId={listing.id} existingCount={photoUrls.length} />

      {photoUrls.length > 0 && (
        <div>
          <h2 className="font-medium text-field mb-2">Current photos ({photoUrls.length})</h2>
          <div className="grid grid-cols-3 gap-2">
            {photoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="w-full aspect-square object-cover rounded-card" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
