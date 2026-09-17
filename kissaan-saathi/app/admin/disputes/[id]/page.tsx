import { createClient } from "@/lib/supabase/server";
import DisputeResolutionForm from "@/components/DisputeResolutionForm";
import Link from "next/link";

export default async function AdminDisputeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: dispute } = await supabase
    .from("disputes")
    .select("id, reason, description, status, resolution, resolution_notes, order_id, buyer_id, created_at")
    .eq("id", params.id)
    .single();

  if (!dispute) return <p className="text-soil/70">Dispute not found.</p>;

  const [{ data: order }, { data: buyerProfile }, { data: evidenceRows }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, quantity, price_per_kg, buyer_total, status, farmer_id, product_listings(name)")
      .eq("id", dispute.order_id)
      .single(),
    supabase.from("buyer_profiles").select("business_name").eq("user_id", dispute.buyer_id).single(),
    supabase.from("dispute_evidence").select("storage_path").eq("dispute_id", dispute.id),
  ]);

  const { data: farmerProfile } = order
    ? await supabase.from("profiles").select("full_name").eq("id", order.farmer_id).single()
    : { data: null };

  const photoUrls = await Promise.all(
    (evidenceRows ?? []).map(async (row) => {
      const { data } = await supabase.storage.from("dispute-evidence").createSignedUrl(row.storage_path, 3600);
      return data?.signedUrl ?? null;
    })
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/admin/disputes" className="text-field underline text-sm">← Back to disputes</Link>

      <div>
        <h1 className="font-display text-2xl text-field">{dispute.reason}</h1>
        <p className="text-soil/60 text-sm">Status: {dispute.status}</p>
      </div>

      <section className="card">
        <h2 className="font-medium text-field mb-2">Description</h2>
        <p className="text-soil/80">{dispute.description}</p>
      </section>

      {order && (
        <section className="card">
          <h2 className="font-medium text-field mb-2">Order</h2>
          {/* @ts-expect-error - relation typed loosely for MVP */}
          <p>{order.product_listings?.name} — {order.quantity} kg @ ₹{order.price_per_kg}/kg</p>
          <p className="text-soil/70 text-sm mt-1">Buyer total: ₹{order.buyer_total} · Order status: {order.status}</p>
          <p className="text-soil/70 text-sm mt-1">
            Buyer: {buyerProfile?.business_name} · Farmer: {farmerProfile?.full_name}
          </p>
        </section>
      )}

      {photoUrls.length > 0 && (
        <section>
          <h2 className="font-medium text-field mb-2">Evidence photos</h2>
          <div className="grid grid-cols-3 gap-2">
            {photoUrls.map((url, i) =>
              url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-card" />
              ) : null
            )}
          </div>
        </section>
      )}

      {dispute.status !== "resolved" && order && (
        <DisputeResolutionForm disputeId={dispute.id} orderId={order.id} orderStatus={order.status} />
      )}

      {dispute.status === "resolved" && (
        <section className="card border-field">
          <h2 className="font-medium text-field mb-1">Resolved</h2>
          <p className="text-soil/80">{dispute.resolution?.replace(/_/g, " ")}</p>
          {dispute.resolution_notes && <p className="text-soil/70 text-sm mt-1">{dispute.resolution_notes}</p>}
        </section>
      )}
    </div>
  );
}
