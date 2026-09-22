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
    // already have a *live* one going — avoids double-offering if the buyer
    // had already opened this listing's chat before tapping Buy. But if the
    // most recent offer's order already reached delivered/completed, that
    // purchase cycle is finished, so this Buy click should start a fresh one
    // instead of reusing (and getting redirected back to) the old order.
    const { data: latestOfferRows } = await supabase
      .from("offers")
      .select("id, status")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1);

    const latestOffer = latestOfferRows?.[0] ?? null;
    let needsNewOffer = !latestOffer;

    if (latestOffer && latestOffer.status === "accepted") {
      const { data: latestOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("offer_id", latestOffer.id)
        .maybeSingle();

      if (latestOrder && (latestOrder.status === "delivered" || latestOrder.status === "completed")) {
        needsNewOffer = true;
      }
    }

    if (needsNewOffer) {
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
    router.push(`/buyer/order-summary/${conversationId}`);
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
