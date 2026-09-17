import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

// This route creates the payment-gateway order and nothing else — it never
// marks anything "paid". Only /api/payments/verify does that, and only
// after checking a cryptographic signature from Razorpay.
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, buyer_id, buyer_total, payment_method, payment_status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "This isn't your order" }, { status: 403 });
    }
    if (order.payment_method !== "online") {
      return NextResponse.json({ error: "This order is set to Cash on Delivery, not online payment" }, { status: 400 });
    }
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "This order is already paid" }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      // Prepared, production-ready structure — but genuinely not usable
      // until real gateway credentials are configured. We say so plainly
      // rather than pretending a payment could go through.
      return NextResponse.json(
        {
          error:
            "Online payment isn't configured yet. An admin needs to set RAZORPAY_KEY_ID and " +
            "RAZORPAY_KEY_SECRET in the server's environment variables.",
        },
        { status: 503 }
      );
    }

    const amountPaise = Math.round(order.buyer_total * 100);

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: order.id,
        notes: { kissaan_saathi_order_id: order.id },
      }),
    });

    if (!razorpayResponse.ok) {
      const errText = await razorpayResponse.text();
      return NextResponse.json({ error: "Payment gateway rejected the request: " + errText }, { status: 502 });
    }

    const razorpayOrder = await razorpayResponse.json();

    // Writing payment_status='processing' requires the service role — an
    // ordinary authenticated client update to this value is blocked by the
    // enforce_payment_status_transition trigger (see 08_payments_cod_radius.sql).
    const service = createServiceRoleClient();
    const { error: updateError } = await service
      .from("orders")
      .update({ payment_status: "processing", razorpay_order_id: razorpayOrder.id })
      .eq("id", order.id);

    if (updateError) {
      return NextResponse.json({ error: "Could not record the payment attempt: " + updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      razorpay_order_id: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      key_id: keyId, // the Key ID is a public identifier, safe to send to the browser
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
