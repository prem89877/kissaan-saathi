import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roadDistanceKm } from "@/lib/roadDistance";

// Wraps create_order_from_offer so the delivery distance used for pricing is
// computed here, server-side, via OSRM road routing — never trusted from the
// browser. The RPC still does all the real work (offer validation, totals,
// RLS-safe insert); this route only adds p_road_distance_km to that call.
//
// create_order_from_offer needs a new p_road_distance_km parameter to accept
// this — see the note at the bottom of supabase/14_delivery_pricing_tiers.sql
// for exactly what to change there.
export async function POST(request: Request) {
  try {
    const { offerId, deliveryMode, paymentMethod } = await request.json();
    if (!offerId || !deliveryMode) {
      return NextResponse.json({ error: "offerId and deliveryMode are required" }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let roadDistance: number | null = null;

    if (deliveryMode === "delivery") {
      const { data: offer } = await supabase
        .from("offers")
        .select("conversation_id")
        .eq("id", offerId)
        .single();

      const { data: conversation } = offer
        ? await supabase
            .from("conversations")
            .select("farmer_id, buyer_id")
            .eq("id", offer.conversation_id)
            .single()
        : { data: null as { farmer_id: string; buyer_id: string } | null };

      if (conversation) {
        const [{ data: farmer }, { data: buyer }] = await Promise.all([
          supabase.from("farmer_profiles").select("lat, lng").eq("user_id", conversation.farmer_id).single(),
          supabase.from("buyer_profiles").select("lat, lng").eq("user_id", conversation.buyer_id).single(),
        ]);
        roadDistance = await roadDistanceKm(
          buyer?.lat ?? null,
          buyer?.lng ?? null,
          farmer?.lat ?? null,
          farmer?.lng ?? null
        );
      }
    }

    const { data: orderId, error: rpcError } = await supabase.rpc("create_order_from_offer", {
      p_offer_id: offerId,
      p_delivery_mode: deliveryMode,
      p_payment_method: deliveryMode === "pickup" ? "online" : paymentMethod,
      p_road_distance_km: roadDistance,
    });

    if (rpcError || !orderId) {
      return NextResponse.json({ error: rpcError?.message ?? "Could not create the order." }, { status: 400 });
    }

    return NextResponse.json({ orderId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
