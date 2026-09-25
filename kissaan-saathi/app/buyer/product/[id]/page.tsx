import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { distanceKm } from "@/lib/distance";
import { calculateDeliveryCost, configFromRows } from "@/lib/deliveryPricing";
import StartChatButton from "@/components/StartChatButton";
import BuyButton from "@/components/BuyButton";
import Link from "next/link";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  const { data: listing } = await supabase
    .from("product_listings")
    .select(
      "id, name, price_per_kg, available_qty, moq, grade, quality_description, harvest_date, shelf_life_days, delivery_radius_km, admin_reviewed, farmer_id, categories(name)"
    )
    .eq("id", params.id)
    .eq("status", "approved")
    .single();

  if (!listing) {
    return (
      <div>
        <p className="text-soil/70">
          This listing isn't available — it may have sold out, been suspended, or no longer exists.
        </p>
        <Link href="/buyer/marketplace" className="text-field underline text-sm mt-3 inline-block">
          ← Back to marketplace
        </Link>
      </div>
    );
  }

  const [{ data: images }, { data: farmerProfile }, { data: farmer }, { data: buyerProfile }, { data: fees }, { data: deliveryConfigRows }] =
    await Promise.all([
      supabase.from("product_images").select("storage_path").eq("listing_id", listing.id),
      supabase.from("profiles").select("full_name").eq("id", listing.farmer_id).single(),
      supabase.from("farmer_profiles").select("farm_name, area, lat, lng").eq("user_id", listing.farmer_id).single(),
      supabase.from("buyer_profiles").select("lat, lng").eq("user_id", userId).single(),
      supabase.from("platform_fees").select("key, value"),
      supabase.from("delivery_pricing_config").select("key, value"),
    ]);

  const photoUrls = (images ?? []).map(
    (img) => supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl
  );

  const buyerFeePct = fees?.find((f) => f.key === "buyer_fee_pct")?.value ?? 0.05;
  const distance = distanceKm(buyerProfile?.lat ?? null, buyerProfile?.lng ?? null, farmer?.lat ?? null, farmer?.lng ?? null);

  // Illustrative breakdown at MOQ — the real, binding total is calculated
  // server-side (calculate_order_totals + calculate_delivery_cost) once
  // quantity is actually agreed through negotiation.
  const exampleQty = listing.moq;
  const productSubtotal = Math.round(exampleQty * listing.price_per_kg * 100) / 100;
  const deliveryCost = calculateDeliveryCost(distance, exampleQty, configFromRows(deliveryConfigRows));
  const buyerFee = Math.round(productSubtotal * buyerFeePct * 100) / 100;
  const total = Math.round((productSubtotal + buyerFee + deliveryCost) * 100) / 100;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/buyer/marketplace" className="text-field underline text-sm">← Back to marketplace</Link>

      {photoUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photoUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="w-full aspect-square object-cover rounded-card" />
          ))}
        </div>
      )}

      <div>
        <div className="flex justify-between items-start">
          <h1 className="font-display text-2xl text-field">{listing.name}</h1>
          {listing.admin_reviewed && (
            <span className="text-xs bg-marigold/20 text-marigold-dark rounded-full px-2 py-1 whitespace-nowrap">
              Admin Reviewed
            </span>
          )}
        </div>
        {/* @ts-expect-error - categories relation typed loosely for MVP */}
        <p className="text-soil/60 text-sm">{listing.categories?.name}</p>
      </div>

      <section className="card">
        <p className="text-2xl font-display text-field">₹{listing.price_per_kg}/kg</p>
        <p className="text-soil/80 mt-1">{listing.available_qty} kg available · MOQ {listing.moq} kg</p>
        {distance != null && <p className="text-soil/60 text-sm mt-1">~{distance} km away</p>}
        {distance != null && distance > 70 && (
          <p className="text-alert text-sm mt-2 font-medium">
            This farmer is outside the 70 km service area — orders here aren't allowed.
          </p>
        )}
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
        <p>Options at checkout: Kissaan Saathi Delivery or Buyer Pickup</p>
        <p className="text-soil/60 text-sm mt-1">
          Kissaan Saathi Delivery cost is calculated below, based on distance and order weight.
          Buyer Pickup has no delivery charge.
        </p>
      </section>

      <section className="card">
        <h2 className="font-medium text-field mb-2">Farmer</h2>
        <p>{farmerProfile?.full_name}</p>
        <p className="text-soil/70 text-sm">{farmer?.farm_name} · {farmer?.area}</p>
      </section>

      <section className="card border-field">
        <h2 className="font-medium text-field mb-3">
          Example total at MOQ ({exampleQty} kg)
        </h2>
        <div className="flex flex-col gap-1 text-soil/90">
          <div className="flex justify-between"><span>Product amount</span><span>₹{productSubtotal}</span></div>
          <div className="flex justify-between"><span>Buyer platform fee ({Math.round(buyerFeePct * 100)}%)</span><span>₹{buyerFee}</span></div>
          <div className="flex justify-between"><span>Kissaan Saathi Delivery charge</span><span>₹{deliveryCost}</span></div>
          <div className="flex justify-between font-medium text-field border-t border-soil/10 pt-2 mt-1">
            <span>Total</span><span>₹{total}</span>
          </div>
        </div>
        <p className="text-soil/50 text-xs mt-3">
          Illustrative at minimum order quantity. Negotiate to change quantity
          or price — your final total is calculated once an order is agreed.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-2">
        {distance != null && distance > 70 ? (
          <p className="text-alert text-sm text-center">
            Chat is disabled — this listing is beyond the 70 km service radius.
          </p>
        ) : (
          <>
            <BuyButton
              listingId={listing.id}
              farmerId={listing.farmer_id}
              moq={listing.moq}
              pricePerKg={listing.price_per_kg}
              userId={userId}
            />
            <StartChatButton listingId={listing.id} farmerId={listing.farmer_id} userId={userId} />
          </>
        )}
        <p className="text-soil/50 text-xs text-center">
          Buy places an offer at the listed price and MOQ for the farmer to accept.
          Negotiate lets you chat and agree on a different price or quantity first.
        </p>
      </section>
    </div>
  );
}
