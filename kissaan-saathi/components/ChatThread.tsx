"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import OfferForm from "./OfferForm";

type Message = { id: string; sender_id: string; body: string; created_at: string };
type Offer = {
  id: string;
  made_by: "farmer" | "buyer";
  quantity: number;
  price_per_kg: number;
  status: "pending" | "accepted" | "rejected" | "countered" | "expired";
  created_at: string;
};

type ConversationInfo = {
  listingName: string;
  listingMoq: number;
  listingPrice: number;
  otherPartyName: string;
};

export default function ChatThread({
  conversationId,
  viewerRole,
  userId: initialUserId,
}: {
  conversationId: string;
  viewerRole: "farmer" | "buyer";
  // Passed down from the server page, which already knows who's signed in
  // (via middleware.ts) — avoids an extra client-side auth.getUser() round
  // trip every time a chat is opened. Falls back to fetching it only if a
  // caller doesn't supply it.
  userId?: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(initialUserId ?? null);
  const [info, setInfo] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [messageText, setMessageText] = useState("");
  const [showOfferForm, setShowOfferForm] = useState<"new" | "counter" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      if (initialUserId) {
        setUserId(initialUserId);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id ?? null);
      }

      const { data: conversation } = await supabase
        .from("conversations")
        .select("listing_id, farmer_id, buyer_id")
        .eq("id", conversationId)
        .single();

      if (conversation) {
        const [{ data: listing }, { data: otherProfile }] = await Promise.all([
          supabase.from("product_listings").select("name, moq, price_per_kg").eq("id", conversation.listing_id).single(),
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", viewerRole === "farmer" ? conversation.buyer_id : conversation.farmer_id)
            .single(),
        ]);
        setInfo({
          listingName: listing?.name ?? "Listing",
          listingMoq: listing?.moq ?? 0,
          listingPrice: listing?.price_per_kg ?? 0,
          otherPartyName: otherProfile?.full_name ?? "—",
        });
      }

      const [{ data: msgs }, { data: offs }] = await Promise.all([
        supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", conversationId).order("created_at"),
        supabase.from("offers").select("id, made_by, quantity, price_per_kg, status, created_at").eq("conversation_id", conversationId).order("created_at"),
      ]);
      setMessages(msgs ?? []);
      setOffers(offs ?? []);
      setLoading(false);

      // Only the most recent offer represents the current purchase cycle —
      // an older accepted offer may belong to an already completed order,
      // and its existence shouldn't hide a fresh pending offer from the
      // other party (or point "View order" at the old, finished order).
      const latestOfferForLoad = (offs ?? [])[(offs ?? []).length - 1];
      const acceptedOffer = latestOfferForLoad && latestOfferForLoad.status === "accepted" ? latestOfferForLoad : null;
      if (acceptedOffer) {
        const { data: order } = await supabase
          .from("orders")
          .select("id")
          .eq("offer_id", acceptedOffer.id)
          .maybeSingle();
        setExistingOrderId(order?.id ?? null);
      }

      // Live updates so both sides see new messages/offers without refreshing.
      channel = supabase
        .channel(`conversation-${conversationId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => setMessages((m) => [...m, payload.new as Message]))
        .on("postgres_changes", { event: "*", schema: "public", table: "offers", filter: `conversation_id=eq.${conversationId}` },
          () => {
            supabase
              .from("offers")
              .select("id, made_by, quantity, price_per_kg, status, created_at")
              .eq("conversation_id", conversationId)
              .order("created_at")
              .then(({ data }) => setOffers(data ?? []));
          })
        .subscribe();
    }

    load();
    return () => { if (channel) supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageText.trim() || !userId) return;
    const body = messageText.trim();
    setMessageText("");
    const { error: sendError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      body,
    });
    if (sendError) setError(sendError.message);
  }

  async function submitOffer(quantity: number, price: number, isCounter: boolean) {
    if (submittingOffer) return; // guard against an accidental double-tap
    setSubmittingOffer(true);
    setError(null);
    // Only one offer should be actionable at a time — supersede any still-pending ones.
    const pendingIds = offers.filter((o) => o.status === "pending").map((o) => o.id);
    if (pendingIds.length > 0) {
      await supabase.from("offers").update({ status: isCounter ? "countered" : "expired" }).in("id", pendingIds);
    }
    const { error: offerError } = await supabase.from("offers").insert({
      conversation_id: conversationId,
      made_by: viewerRole,
      quantity,
      price_per_kg: price,
      status: "pending",
    });
    if (offerError) setError(offerError.message);
    setSubmittingOffer(false);
    setShowOfferForm(null);
  }

  async function respondToOffer(offerId: string, status: "accepted" | "rejected") {
    setError(null);
    const { error: respondError } = await supabase.from("offers").update({ status }).eq("id", offerId);
    if (respondError) setError(respondError.message);
  }

  async function createOrder(offerId: string) {
    setCreatingOrder(true);
    setError(null);
    const res = await fetch("/api/orders/create-from-offer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId,
        deliveryMode,
        paymentMethod: deliveryMode === "pickup" ? "online" : paymentMethod,
      }),
    });
    const { orderId, error: apiError } = await res.json();
    setCreatingOrder(false);
    if (!res.ok || !orderId) {
      setError(apiError ?? "Could not create the order.");
      return;
    }
    setExistingOrderId(orderId as string);
    router.push(`/buyer/orders/${orderId}`);
  }

  if (loading) return <p className="text-soil/60">Loading conversation…</p>;

  const latestOffer = offers[offers.length - 1];
  const isMyTurnToRespond = latestOffer && latestOffer.status === "pending" && latestOffer.made_by !== viewerRole;
  const isWaitingOnOther = latestOffer && latestOffer.status === "pending" && latestOffer.made_by === viewerRole;
  // Same rule at render time: an old accepted offer from a finished
  // purchase cycle should not mask a new pending offer.
  const accepted = latestOffer && latestOffer.status === "accepted" ? latestOffer : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="pb-3 border-b border-soil/10 mb-3">
        <p className="font-medium text-soil">{info?.listingName}</p>
        <p className="text-soil/60 text-sm">with {info?.otherPartyName}</p>
      </div>

      {accepted && (
        <div className="card border-field mb-3">
          <p className="font-medium text-field">Offer accepted</p>
          <p className="text-soil/80 text-sm mb-3">
            {accepted.quantity} kg @ ₹{accepted.price_per_kg}/kg
          </p>
          {existingOrderId ? (
            <a href={`/${viewerRole}/orders/${existingOrderId}`} className="btn-primary block text-center">
              View order
            </a>
          ) : viewerRole === "buyer" ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-soil/60 mb-1">{t("delivery.label")}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("delivery")}
                    className={deliveryMode === "delivery" ? "btn-primary flex-1" : "btn-secondary flex-1"}
                  >
                    {t("delivery.kissaanSaathiDelivery")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMode("pickup");
                      setPaymentMethod("online");
                    }}
                    className={deliveryMode === "pickup" ? "btn-primary flex-1" : "btn-secondary flex-1"}
                  >
                    {t("delivery.buyerPickup")}
                  </button>
                </div>
                {deliveryMode === "pickup" && (
                  <p className="text-soil/60 text-xs mt-1">
                    {t("delivery.pickupNote")}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-soil/60 mb-1">{t("payment.method")}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online")}
                    className={paymentMethod === "online" ? "btn-primary flex-1" : "btn-secondary flex-1"}
                  >
                    {t("payment.online")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    disabled={deliveryMode === "pickup"}
                    className={
                      paymentMethod === "cod" && deliveryMode !== "pickup"
                        ? "btn-primary flex-1"
                        : "btn-secondary flex-1 disabled:opacity-40"
                    }
                  >
                    {t("payment.cod")}
                  </button>
                </div>
                {deliveryMode === "pickup" && (
                  <p className="text-soil/60 text-xs mt-1">
                    {t("payment.codDisabledForPickup")}
                  </p>
                )}
              </div>

              <button onClick={() => createOrder(accepted.id)} disabled={creatingOrder} className="btn-primary w-full">
                {creatingOrder ? "Creating order…" : t("order.createOrder")}
              </button>
            </div>
          ) : (
            <p className="text-soil/60 text-sm">Waiting for the buyer to place the order.</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-card px-3 py-2 text-sm ${
              m.sender_id === userId ? "bg-field text-sand self-end" : "bg-white border border-soil/10 self-start"
            }`}
          >
            {m.body}
          </div>
        ))}

        {offers.map((o) => (
          <div key={o.id} className="self-center text-xs text-soil/60 bg-sand-dark rounded-full px-3 py-1">
            {o.made_by === "farmer" ? "Farmer" : "Buyer"} offered {o.quantity} kg @ ₹{o.price_per_kg}/kg — {o.status}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-alert text-sm mb-2">{error}</p>}

      {!accepted && showOfferForm && (
        <OfferForm
          initialQuantity={latestOffer?.quantity ?? info?.listingMoq ?? 1}
          initialPrice={latestOffer?.price_per_kg ?? info?.listingPrice ?? 1}
          submitLabel={showOfferForm === "counter" ? "Send counter offer" : "Send offer"}
          onSubmit={(q, p) => submitOffer(q, p, showOfferForm === "counter")}
          onCancel={() => setShowOfferForm(null)}
          disabled={submittingOffer}
        />
      )}

      {!accepted && !showOfferForm && (
        <div className="flex flex-col gap-2 mb-2">
          {isMyTurnToRespond && (
            <div className="flex gap-2">
              <button onClick={() => respondToOffer(latestOffer.id, "accepted")} className="btn-primary flex-1">
                Accept {latestOffer.quantity} kg @ ₹{latestOffer.price_per_kg}
              </button>
              <button onClick={() => respondToOffer(latestOffer.id, "rejected")} className="btn-secondary flex-1">
                Reject
              </button>
            </div>
          )}
          {isMyTurnToRespond && (
            <button onClick={() => setShowOfferForm("counter")} className="btn-secondary">
              Counter offer
            </button>
          )}
          {isWaitingOnOther && (
            <p className="text-soil/60 text-sm text-center">
              Waiting for {viewerRole === "buyer" ? "farmer" : "buyer"} to respond to your offer…
            </p>
          )}
          {!latestOffer && (
            <button onClick={() => setShowOfferForm("new")} className="btn-secondary">
              Make an offer
            </button>
          )}
        </div>
      )}

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="Type a message…"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
        />
        <button type="submit" className="btn-primary px-4">Send</button>
      </form>
    </div>
  );
}
