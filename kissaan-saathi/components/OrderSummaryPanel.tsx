"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type Offer = {
  id: string;
  made_by: "farmer" | "buyer";
  quantity: number;
  price_per_kg: number;
  status: "pending" | "accepted" | "rejected" | "countered" | "expired";
};

type ConversationInfo = {
  listingName: string;
  otherPartyName: string;
};

export default function OrderSummaryPanel({ conversationId }: { conversationId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useTranslation();
  const [info, setInfo] = useState<ConversationInfo | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("listing_id, farmer_id")
        .eq("id", conversationId)
        .single();

      if (conversation) {
        const [{ data: listing }, { data: farmerProfile }] = await Promise.all([
          supabase.from("product_listings").select("name").eq("id", conversation.listing_id).single(),
          supabase.from("profiles").select("full_name").eq("id", conversation.farmer_id).single(),
        ]);
        setInfo({
          listingName: listing?.name ?? "Listing",
          otherPartyName: farmerProfile?.full_name ?? "the farmer",
        });
      }

      const { data: offs } = await supabase
        .from("offers")
        .select("id, made_by, quantity, price_per_kg, status")
        .eq("conversation_id", conversationId)
        .order("created_at");
      setOffers(offs ?? []);
      setLoading(false);

      // Only the most recent offer represents the current purchase cycle —
      // an older accepted offer may belong to an already completed order,
      // and its existence shouldn't redirect the buyer back to it.
      const latest = (offs ?? [])[(offs ?? []).length - 1];
      const acceptedOffer = latest && latest.status === "accepted" ? latest : null;
      if (acceptedOffer) {
        const { data: order } = await supabase
          .from("orders")
          .select("id")
          .eq("offer_id", acceptedOffer.id)
          .maybeSingle();
        setExistingOrderId(order?.id ?? null);
      }

      // Live updates: as soon as the farmer accepts (or counters) the offer
      // this screen refreshes itself without the buyer needing to reload.
      channel = supabase
        .channel(`order-summary-${conversationId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "offers", filter: `conversation_id=eq.${conversationId}` },
          () => {
            supabase
              .from("offers")
              .select("id, made_by, quantity, price_per_kg, status")
              .eq("conversation_id", conversationId)
              .order("created_at")
              .then(({ data }) => setOffers(data ?? []));
          }
        )
        .subscribe();
    }

    load();
    return () => { if (channel) supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (existingOrderId) {
      router.replace(`/buyer/orders/${existingOrderId}`);
    }
  }, [existingOrderId, router]);

  async function createOrder(offerId: string) {
    setCreatingOrder(true);
    setError(null);
    const { data: orderId, error: rpcError } = await supabase.rpc("create_order_from_offer", {
      p_offer_id: offerId,
      p_delivery_mode: deliveryMode,
      p_payment_method: deliveryMode === "pickup" ? "online" : paymentMethod,
    });
    setCreatingOrder(false);
    if (rpcError || !orderId) {
      setError(rpcError?.message ?? "Could not create the order.");
      return;
    }
    router.push(`/buyer/orders/${orderId}`);
  }

  if (loading) return <p className="text-soil/60">Loading order…</p>;

  const latestOffer = offers[offers.length - 1];
  const accepted = latestOffer && latestOffer.status === "accepted" ? latestOffer : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-medium text-soil">{info?.listingName}</p>
        <p className="text-soil/60 text-sm">with {info?.otherPartyName}</p>
      </div>

      {error && <p className="text-alert text-sm">{error}</p>}

      {accepted && !existingOrderId && (
        <div className="card border-field">
          <p className="font-medium text-field">Offer accepted</p>
          <p className="text-soil/80 text-sm mb-3">
            {accepted.quantity} kg @ ₹{accepted.price_per_kg}/kg
          </p>

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
                <p className="text-soil/60 text-xs mt-1">{t("delivery.pickupNote")}</p>
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
                <p className="text-soil/60 text-xs mt-1">{t("payment.codDisabledForPickup")}</p>
              )}
            </div>

            <button onClick={() => createOrder(accepted.id)} disabled={creatingOrder} className="btn-primary w-full">
              {creatingOrder ? "Creating order…" : t("order.createOrder")}
            </button>
          </div>
        </div>
      )}

      {!accepted && latestOffer && latestOffer.status === "pending" && (
        <div className="card">
          <p className="font-medium text-field">Waiting for {info?.otherPartyName} to accept</p>
          <p className="text-soil/80 text-sm mt-1">
            You offered {latestOffer.quantity} kg @ ₹{latestOffer.price_per_kg}/kg. You'll be able to
            choose delivery and payment here as soon as it's accepted.
          </p>
        </div>
      )}

      {!accepted && (!latestOffer || latestOffer.status !== "pending") && (
        <div className="card">
          <p className="text-soil/80 text-sm">
            There's no active offer on this order right now — open the chat to make or check one.
          </p>
        </div>
      )}

      <a href={`/buyer/chat/${conversationId}`} className="text-field underline text-sm text-center">
        Open chat with {info?.otherPartyName}
      </a>
    </div>
  );
}
