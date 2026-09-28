import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

// Marks a COD order's cash as collected BY THE DELIVERY PARTNER.
//
// Why this is an API route and not a plain client-side `.update()` or even
// a normal SECURITY DEFINER RPC: the existing DB trigger
// enforce_payment_status_transition (from an earlier migration, confirmed
// via `pg_get_functiondef`) hard-codes that a 'cod_collected' transition is
// only allowed "and only from cod_pending" when auth.uid() = the order's
// farmer_id — for ANY authenticated caller, including one running inside a
// SECURITY DEFINER function (auth.uid() reflects the real caller's JWT
// regardless of the function's security context, so that wouldn't bypass
// it). The one caller that trigger doesn't restrict is a request with no
// user JWT at all — i.e. the service-role key, used server-side here only
// after this route does its own authorization check.
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, farmer_id, delivery_partner_id, delivery_mode, payment_method, payment_status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.delivery_partner_id !== user.id) {
      return NextResponse.json({ error: "This order is not assigned to you" }, { status: 403 });
    }
    if (order.delivery_mode !== "delivery") {
      return NextResponse.json({ error: "This order doesn't use delivery-partner delivery" }, { status: 400 });
    }
    if (order.payment_method !== "cod") {
      return NextResponse.json({ error: "This order is not Cash on Delivery" }, { status: 400 });
    }
    if (order.payment_status !== "cod_pending") {
      return NextResponse.json({ error: "This order's cash has already been recorded" }, { status: 400 });
    }

    const service = createServiceRoleClient();
    const { data: updated, error: updateError } = await service
      .from("orders")
      .update({ payment_status: "cod_collected", cod_collected_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("payment_status", "cod_pending") // guards against a double-tap race
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Already recorded" }, { status: 409 });
    }

    try {
      await service.rpc("create_notification", {
        p_recipient: order.farmer_id,
        p_type: "cod_collected_by_partner",
        p_title: "Cash collected",
        p_message: "The delivery partner collected the COD payment for this order from the buyer.",
        p_link: `/farmer/orders/${orderId}`,
        p_order: orderId,
        p_skip_actor: false,
      });
      const { data: adminIds } = await service.rpc("notif_admin_ids");
      for (const row of (adminIds ?? []) as unknown as { notif_admin_ids: string }[] | string[]) {
        const adminId = typeof row === "string" ? row : row.notif_admin_ids;
        if (!adminId) continue;
        await service.rpc("create_notification", {
          p_recipient: adminId,
          p_type: "cod_collected_admin",
          p_title: "COD cash collected by delivery partner",
          p_message: "A delivery partner collected cash — pending deposit and reconciliation.",
          p_link: "/admin/orders",
          p_order: orderId,
          p_skip_actor: false,
        });
      }
    } catch {
      // Non-fatal — the collection itself already succeeded.
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
