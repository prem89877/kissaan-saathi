import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

export default async function BuyerChatsPage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, listing_id, farmer_id, created_at")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });

  const listingIds = Array.from(new Set((conversations ?? []).map((c) => c.listing_id)));
  const farmerIds = Array.from(new Set((conversations ?? []).map((c) => c.farmer_id)));

  const [{ data: listings }, { data: farmers }] = await Promise.all([
    listingIds.length
      ? supabase.from("product_listings").select("id, name").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    farmerIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", farmerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const listingById = new Map((listings ?? []).map((l) => [l.id, l.name]));
  const farmerById = new Map((farmers ?? []).map((f) => [f.id, f.full_name]));

  return (
    <div>
      <h1 className="font-display text-2xl text-field mb-6">Negotiations</h1>
      {(!conversations || conversations.length === 0) && (
        <p className="text-soil/70">
          No conversations yet. Start one from a product page in the marketplace.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {conversations?.map((c) => (
          <Link key={c.id} href={`/buyer/chat/${c.id}`} className="card block">
            <p className="font-medium text-soil">{listingById.get(c.listing_id) ?? "Listing"}</p>
            <p className="text-soil/60 text-sm mt-1">with {farmerById.get(c.farmer_id) ?? "Farmer"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
