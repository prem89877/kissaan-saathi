import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

export default async function FarmerChatsPage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, listing_id, buyer_id, created_at")
    .eq("farmer_id", userId)
    .order("created_at", { ascending: false });

  const listingIds = Array.from(new Set((conversations ?? []).map((c) => c.listing_id)));
  const buyerIds = Array.from(new Set((conversations ?? []).map((c) => c.buyer_id)));

  const [{ data: listings }, { data: buyers }] = await Promise.all([
    listingIds.length
      ? supabase.from("product_listings").select("id, name").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    buyerIds.length
      ? supabase.from("buyer_profiles").select("user_id, business_name").in("user_id", buyerIds)
      : Promise.resolve({ data: [] as { user_id: string; business_name: string }[] }),
  ]);

  const listingById = new Map((listings ?? []).map((l) => [l.id, l.name]));
  const buyerById = new Map((buyers ?? []).map((b) => [b.user_id, b.business_name]));

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Negotiations</h1>
      {(!conversations || conversations.length === 0) && (
        <p className="text-soil/70">
          No buyer conversations yet. They'll show up here once a buyer messages you about a listing.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {conversations?.map((c) => (
          <Link key={c.id} href={`/farmer/chat/${c.id}`} className="card block">
            <p className="font-medium text-soil">{listingById.get(c.listing_id) ?? "Listing"}</p>
            <p className="text-soil/60 text-sm mt-1">with {buyerById.get(c.buyer_id) ?? "Buyer"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
