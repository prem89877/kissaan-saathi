"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OfferInfo = {
  id: string;
  conversation_id: string;
  quantity: number;
  price_per_kg: number;
  status: "pending" | "accepted" | "rejected" | "countered" | "expired";
};

// The dedicated screen a farmer lands on from the Dashboard's "New Orders"
// list. It mirrors exactly what the chat screen already offers for a
// pending buyer offer (Accept / Reject / Counter offer) so both entry
// points behave the same way.
export default function PendingOfferPanel({ offerId }: { offerId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [offer, setOffer] = useState<OfferInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [listingName, setListingName] = useState("Listing");
  const [buyerName, setBuyerName] = useState("the buyer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: off } = await supabase
        .from("offers")
        .select("id, conversation_id, quantity, price_per_kg, status")
        .eq("id", offerId)
        .single();

      if (!off) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setOffer(off);

      const { data: conversation } = await supabase
        .from("conversations")
        .select("listing_id, buyer_id")
        .eq("id", off.conversation_id)
        .single();

      if (conversation) {
        const [{ data: listing }, { data: buyerProfile }] = await Promise.all([
          supabase.from("product_listings").select("name").eq("id", conversation.listing_id).single(),
          supabase.from("buyer_profiles").select("business_name").eq("user_id", conversation.buyer_id).single(),
        ]);
        setListingName(listing?.name ?? "Listing");
        setBuyerName(buyerProfile?.business_name ?? "the buyer");
      }
      setLoading(false);
    }
    load();
  }, [offerId]);

  async function acceptOffer() {
    if (!offer) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("offers")
      .update({ status: "accepted" })
      .eq("id", offer.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    // Same place the chat's own Accept button already sends the farmer —
    // it shows "Offer accepted… waiting for the buyer to place the order."
    router.push(`/farmer/chat/${offer.conversation_id}`);
  }

  function goToChatForCounter() {
    if (!offer) return;
    router.push(`/farmer/chat/${offer.conversation_id}`);
  }

  async function confirmReject() {
    if (!offer) return;
    if (!reason.trim()) {
      setError("Please type a reason — the buyer will see this.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("offers")
      .update({ status: "rejected", rejection_reason: reason.trim() })
      .eq("id", offer.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/farmer/dashboard");
  }

  if (loading) return <p className="text-soil/60">Loading order…</p>;
  if (notFound || !offer) return <p className="text-soil/70">Order not found.</p>;

  if (offer.status !== "pending") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-soil/70">This order has already been responded to.</p>
        <a href={`/farmer/chat/${offer.conversation_id}`} className="text-field underline text-sm">
          Open chat
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-medium text-soil">{listingName}</p>
        <p className="text-soil/60 text-sm">from {buyerName}</p>
      </div>

      <div className="card border-field">
        <p className="font-medium text-field">New order</p>
        <p className="text-soil/80 text-sm mt-1">
          {offer.quantity} kg @ ₹{offer.price_per_kg}/kg
        </p>
      </div>

      {error && <p className="text-alert text-sm">{error}</p>}

      {!showReject ? (
        <div className="flex flex-col gap-2">
          <button onClick={acceptOffer} disabled={saving} className="btn-primary w-full">
            {saving ? "Saving…" : `Accept ${offer.quantity} kg @ ₹${offer.price_per_kg}`}
          </button>
          <button
            onClick={() => {
              setError(null);
              setShowReject(true);
            }}
            disabled={saving}
            className="btn-secondary w-full"
          >
            Reject
          </button>
          <button onClick={goToChatForCounter} disabled={saving} className="btn-secondary w-full">
            Counter offer
          </button>
        </div>
      ) : (
        <div className="card">
          <p className="font-medium text-soil mb-2">Reject order</p>
          <textarea
            className="input-field min-h-[80px] mb-3"
            placeholder="Reason (visible to the buyer)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={confirmReject} disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving…" : "Confirm reject"}
            </button>
            <button
              onClick={() => {
                setShowReject(false);
                setReason("");
                setError(null);
              }}
              disabled={saving}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <a href={`/farmer/chat/${offer.conversation_id}`} className="text-field underline text-sm text-center">
        Open chat with {buyerName}
      </a>
    </div>
  );
}
