import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/distance";
import MarketplaceBrowser, { type MarketplaceListing } from "@/components/MarketplaceBrowser";

export default async function MarketplacePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: buyerProfile }, { data: listings }, { data: categories }] = await Promise.all([
    supabase.from("buyer_profiles").select("lat, lng").eq("user_id", user!.id).single(),
    supabase
      .from("product_listings")
      .select(
        "id, name, price_per_kg, available_qty, moq, grade, harvest_date, farmer_id, categories(name), product_images(storage_path)"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  const farmerIds = Array.from(new Set((listings ?? []).map((l) => l.farmer_id)));
  const { data: farmers } = farmerIds.length
    ? await supabase
        .from("farmer_profiles")
        .select("user_id, lat, lng")
        .in("user_id", farmerIds)
    : { data: [] as { user_id: string; lat: number | null; lng: number | null }[] };
  const { data: farmerNames } = farmerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", farmerIds)
    : { data: [] as { id: string; full_name: string }[] };

  const farmerById = new Map((farmers ?? []).map((f) => [f.user_id, f]));
  const nameById = new Map((farmerNames ?? []).map((f) => [f.id, f.full_name]));

  const mapped: MarketplaceListing[] = (listings ?? []).map((l: any) => {
    const farmer = farmerById.get(l.farmer_id);
    const thumbPath = l.product_images?.[0]?.storage_path;
    return {
      id: l.id,
      name: l.name,
      price_per_kg: l.price_per_kg,
      available_qty: l.available_qty,
      moq: l.moq,
      grade: l.grade,
      harvest_date: l.harvest_date,
      category_name: l.categories?.name ?? null,
      farmer_name: nameById.get(l.farmer_id) ?? null,
      distance_km: distanceKm(buyerProfile?.lat ?? null, buyerProfile?.lng ?? null, farmer?.lat ?? null, farmer?.lng ?? null),
      thumb_url: thumbPath ? supabase.storage.from("product-images").getPublicUrl(thumbPath).data.publicUrl : null,
    };
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-4">Marketplace</h1>
      <MarketplaceBrowser listings={mapped} categories={categories ?? []} />
    </div>
  );
}
