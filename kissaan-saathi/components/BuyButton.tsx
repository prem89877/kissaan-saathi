"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function BuyButton({
  listingId,
  farmerId,
  moq,
  pricePerKg,
}: {
  listingId: string;
  farmerId: string;
  moq: number;
  pricePerKg: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Please log in again.");
      setLoading(false);
      return;
    }

    // Reuse the same conversation the Negotiate button would use — a buyer
    // only ever gets one conversation per listing.
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .maybeSingle();

    let conversationId = existing?.id ?? null;

    if (!conversationId) {
      const { data: created, error: createError } = await supabase
        .from("conversations")
        .insert({ listing_id: listingId, farmer_id: farmerId, buyer_id: user.id })
        .select("id")
        .single();

      if (createError || !created) {
        setError("Could not start the order: " + (createError?.message ?? "unknown error"));
        setLoading(false);
        return;
      }
      conversationId = created.id;
    }

    // Only place the at-listed-price offer if this conversation doesn't
    // already have one going — avoids double-offering if the buyer had
    // already opened this listing's chat before tapping Buy.
    const { data: existingOffers } = await supabase
      .from("offers")
      .select("id")
      .eq("conversation_id", conversationId)
      .limit(1);

    if (!existingOffers || existingOffers.length === 0) {
      const { error: offerError } = await supabase.from("offers").insert({
        conversation_id: conversationId,
        made_by: "buyer",
        quantity: moq,
        price_per_kg: pricePerKg,
        status: "pending",
      });
      if (offerError) {
        setError("Could not place the order offer: " + offerError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.push(`/buyer/chat/${conversationId}`);
  }

  return (
    <div>
      {error && <p className="text-alert text-sm mb-2">{error}</p>}
      <button onClick={handleClick} disabled={loading} className="btn-primary w-full">
        {loading ? "Placing order…" : `Buy ${moq} kg @ ₹${pricePerKg}/kg`}
      </button>
    </div>
  );
}
