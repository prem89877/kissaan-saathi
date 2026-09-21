import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export async function POST(request: Request) {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();
    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, buyer_id, buyer_total, razorpay_order_id, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "This isn't your order" }, { status: 403 });
    }
    if (order.razorpay_order_id !== razorpay_order_id) {
      return NextResponse.json({ error: "This payment doesn't match this order" }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: "Payment gateway not configured on the server." }, { status: 503 });
    }

    // The one check that actually proves this payment is genuine: Razorpay
    // signs `${order_id}|${payment_id}` with the secret key, and we
    // recompute that signature here, server-side. We never mark an order
    // paid based on what the frontend merely claims happened.
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const service = createServiceRoleClient();

    if (expectedSignature !== razorpay_signature) {
      await service.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
    }

    const { error: updateError } = await service
      .from("orders")
      .update({ payment_status: "paid", razorpay_payment_id })
      .eq("id", order.id);

    if (updateError) {
      return NextResponse.json({ error: "Payment verified but couldn't be recorded: " + updateError.message }, { status: 500 });
    }

    await service.from("payments").insert({
      order_id: order.id,
      amount: order.buyer_total,
      type: "buyer_charge",
      status: "settled",
    });

    // A confirmed online payment IS the buyer's confirmation of the order —
    // no separate "Confirm & Place Order" click needed after this. Only
    // moves it forward if it's still sitting at 'agreed'; harmless no-op
    // otherwise (e.g. a retried verification call).
    if (order.status === "agreed") {
      await service.from("orders").update({ status: "order_placed" }).eq("id", order.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
