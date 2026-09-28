import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { distanceKm } from "@/lib/distance";
import { roadDistanceKm } from "@/lib/roadDistance";

// Called by the farmer's "Ready for Pickup" action for delivery_mode =
// 'delivery' orders, replacing a raw client-side status update. This route:
//   1. Moves the order 'packed' -> 'out_for_delivery' (still goes through
//      the ordinary authenticated client, so enforce_order_transition and
//      the existing notif_order_event 'delivery_available' broadcast to
//      all delivery partners still run exactly as before — auto-assignment
//      below is an ADDITION on top of that broadcast, not a replacement).
//   2. Tries to automatically assign the nearest eligible online delivery
//      partner. If none is eligible, the order is simply left unassigned —
//      it still shows up in every delivery partner's "Available for
//      pickup" list (existing DeliveryClaimButton flow) as a fallback, and
//      Admin is notified.
//
// Eligibility for auto-assignment (Part D):
//   - is_online = true in delivery_partner_status
//   - location fresher than 15 minutes
//   - fewer than MAX_CONCURRENT_DELIVERIES active (out_for_delivery) orders
//   - within SUPPORTED_RADIUS_KM one-way road distance of the farmer
// Nearest is picked by actual road distance (OSRM), computed only for the
// closest few candidates by straight-line distance first, to avoid firing
// a routing request for every online partner in the city.

const LOCATION_FRESHNESS_MINUTES = 15;
const MAX_CONCURRENT_DELIVERIES = 3;
const SUPPORTED_RADIUS_KM = 30;
const ROAD_DISTANCE_CANDIDATE_LIMIT = 5;

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
      .select("id, farmer_id, status, delivery_mode, delivery_partner_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.farmer_id !== user.id) {
      return NextResponse.json({ error: "This isn't your order" }, { status: 403 });
    }
    if (order.delivery_mode !== "delivery") {
      return NextResponse.json({ error: "This order doesn't use delivery-partner delivery" }, { status: 400 });
    }

    // The real transition check (is this a valid move from the order's
    // CURRENT status?) is still enforce_order_transition, on the actual
    // table — this update goes through the same authenticated client any
    // other status button uses, no bypass.
    const { error: statusError } = await supabase
      .from("orders")
      .update({ status: "out_for_delivery" })
      .eq("id", orderId);

    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 400 });
    }

    const service = createServiceRoleClient();

    const { data: farmer } = await service
      .from("farmer_profiles")
      .select("lat, lng")
      .eq("user_id", order.farmer_id)
      .single();

    if (farmer?.lat == null || farmer?.lng == null) {
      // No farmer coordinates on file — nothing to measure distance from.
      // The order is still correctly out_for_delivery and open for manual
      // claim; just flag it for Admin instead of guessing an assignment.
      await notifyAdminsAwaitingAssignment(service, orderId, "farmer location not set");
      return NextResponse.json({ assigned: false, reason: "farmer_location_missing" });
    }

    const freshSince = new Date(Date.now() - LOCATION_FRESHNESS_MINUTES * 60 * 1000).toISOString();
    const { data: candidates } = await service
      .from("delivery_partner_status")
      .select("partner_id, latitude, longitude, updated_at")
      .eq("is_online", true)
      .gte("updated_at", freshSince)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (!candidates || candidates.length === 0) {
      await notifyAdminsAwaitingAssignment(service, orderId, "no delivery partners online");
      return NextResponse.json({ assigned: false, reason: "no_partners_online" });
    }

    // Exclude partners already juggling too many active deliveries.
    const candidateIds = candidates.map((c) => c.partner_id);
    const { data: activeCounts } = await service
      .from("orders")
      .select("delivery_partner_id")
      .in("delivery_partner_id", candidateIds)
      .eq("status", "out_for_delivery");

    const loadMap = new Map<string, number>();
    for (const row of activeCounts ?? []) {
      const id = row.delivery_partner_id as string;
      loadMap.set(id, (loadMap.get(id) ?? 0) + 1);
    }

    const eligible = candidates.filter((c) => (loadMap.get(c.partner_id) ?? 0) < MAX_CONCURRENT_DELIVERIES);

    if (eligible.length === 0) {
      await notifyAdminsAwaitingAssignment(service, orderId, "all online partners at capacity");
      return NextResponse.json({ assigned: false, reason: "all_partners_at_capacity" });
    }

    // Rank by straight-line distance first (cheap, no external calls), then
    // only ask OSRM for real road distance on the closest few — keeps this
    // request fast and avoids hammering the shared OSRM demo server.
    const byStraightLine = eligible
      .map((c) => ({
        ...c,
        straightLineKm: distanceKm(farmer.lat, farmer.lng, c.latitude, c.longitude) ?? Infinity,
      }))
      .sort((a, b) => a.straightLineKm - b.straightLineKm)
      .slice(0, ROAD_DISTANCE_CANDIDATE_LIMIT);

    const withRoadDistance = await Promise.all(
      byStraightLine.map(async (c) => ({
        partnerId: c.partner_id as string,
        roadKm: await roadDistanceKm(farmer.lat, farmer.lng, c.latitude, c.longitude),
      }))
    );

    const withinRadius = withRoadDistance
      .filter((c): c is { partnerId: string; roadKm: number } => c.roadKm != null && c.roadKm <= SUPPORTED_RADIUS_KM)
      .sort((a, b) => a.roadKm - b.roadKm);

    if (withinRadius.length === 0) {
      await notifyAdminsAwaitingAssignment(service, orderId, `nearest online partner is beyond ${SUPPORTED_RADIUS_KM}km`);
      return NextResponse.json({ assigned: false, reason: "no_partner_within_radius" });
    }

    const chosen = withinRadius[0];

    // Conditional write: only succeeds if still unassigned. Protects
    // against a race with another concurrent auto-assign call or a
    // delivery partner manually claiming the same order at the same
    // moment (DeliveryClaimButton uses this identical guard).
    const { data: assignedRows, error: assignError } = await service
      .from("orders")
      .update({ delivery_partner_id: chosen.partnerId, assigned_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("delivery_partner_id", null)
      .eq("status", "out_for_delivery")
      .select("id");

    if (assignError) {
      return NextResponse.json({ assigned: false, error: assignError.message }, { status: 500 });
    }
    if (!assignedRows || assignedRows.length === 0) {
      // Someone else (or a concurrent call) already claimed/assigned it —
      // not an error, just no longer our job to assign.
      return NextResponse.json({ assigned: false, reason: "already_assigned" });
    }

    try {
      await service.rpc("create_notification", {
        p_recipient: chosen.partnerId,
        p_type: "delivery_assigned_you",
        p_title: "New delivery assigned to you",
        p_message: `You've been automatically assigned a delivery (~${chosen.roadKm.toFixed(1)} km pickup).`,
        p_link: "/delivery/dashboard",
        p_order: orderId,
        p_skip_actor: false,
      });
    } catch {
      // Non-fatal — assignment already succeeded.
    }

    return NextResponse.json({ assigned: true, partnerId: chosen.partnerId, roadKm: chosen.roadKm });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

async function notifyAdminsAwaitingAssignment(
  service: ReturnType<typeof createServiceRoleClient>,
  orderId: string,
  reason: string
) {
  try {
    const { data: adminIds } = await service.rpc("notif_admin_ids");
    for (const row of (adminIds ?? []) as unknown as { notif_admin_ids: string }[] | string[]) {
      const adminId = typeof row === "string" ? row : row.notif_admin_ids;
      if (!adminId) continue;
      await service.rpc("create_notification", {
        p_recipient: adminId,
        p_type: "order_awaiting_assignment",
        p_title: "Order awaiting delivery assignment",
        p_message: `An order is ready for pickup but couldn't be auto-assigned (${reason}). It's visible for manual claim.`,
        p_link: "/admin/orders",
        p_order: orderId,
        p_skip_actor: false,
      });
    }
  } catch {
    // Best-effort only — never let an admin-notification hiccup surface as
    // a user-facing error for the farmer who just tapped "Ready for Pickup".
  }
}
