import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import PickupLocationForm from "@/components/PickupLocationForm";
import Link from "next/link";

export default async function ListingPickupLocationPage({ params }: { params: { id: string } }) {
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

  // RLS (see 09_farmer_pickup_location.sql) already restricts this row to
  // its own farmer, but the explicit farmer_id check above is the actual
  // authorization gate for this page's UI.
  const { data: pickup } = await supabase
    .from("listing_pickup_locations")
    .select(
      "pickup_latitude, pickup_longitude, pickup_address, pickup_landmark, pickup_instructions, pickup_location_confirmed"
    )
    .eq("listing_id", listing.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/farmer/listings" className="text-field underline text-sm">← Back to listings</Link>
      <h1 className="font-display text-2xl text-field">{listing.name}</h1>

      <PickupLocationForm
        listingId={listing.id}
        initial={{
          latitude: pickup?.pickup_latitude ?? null,
          longitude: pickup?.pickup_longitude ?? null,
          address: pickup?.pickup_address ?? "",
          landmark: pickup?.pickup_landmark ?? "",
          instructions: pickup?.pickup_instructions ?? "",
          confirmed: pickup?.pickup_location_confirmed ?? false,
        }}
      />
    </div>
  );
}
