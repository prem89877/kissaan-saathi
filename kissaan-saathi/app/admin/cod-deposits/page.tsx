import { createClient } from "@/lib/supabase/server";
import ConfirmCodDepositButton from "@/components/ConfirmCodDepositButton";
import Link from "next/link";

const AGING_DAYS = 2;

export default async function AdminCodDepositsPage() {
  const supabase = createClient();

  const [{ data: deposits }, { data: uncollectedDeposits }] = await Promise.all([
    supabase
      .from("cod_cash_deposits")
      .select("id, delivery_partner_id, order_ids, amount, status, note, created_at, confirmed_at")
      .order("created_at", { ascending: false }),
    // Cash a delivery partner has collected but hasn't even submitted a
    // deposit request for yet — see 24_cod_collected_at.sql. Distinct from
    // a 'pending' cod_cash_deposits row, which means they DID submit one
    // and it's Admin who hasn't confirmed it.
    supabase
      .from("orders")
      .select("id, delivery_partner_id, buyer_total, cod_collected_at")
      .eq("payment_method", "cod")
      .eq("payment_status", "cod_collected")
      .is("cod_deposit_id", null)
      .order("cod_collected_at", { ascending: true }),
  ]);

  const partnerIds = Array.from(
    new Set([
      ...(deposits ?? []).map((d) => d.delivery_partner_id),
      ...(uncollectedDeposits ?? []).map((o) => o.delivery_partner_id),
    ])
  );
  const { data: profiles } = partnerIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", partnerIds)
    : { data: [] as { id: string; full_name: string; phone: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const phoneById = new Map((profiles ?? []).map((p) => [p.id, p.phone]));

  const pending = (deposits ?? []).filter((d) => d.status === "pending");
  const confirmed = (deposits ?? []).filter((d) => d.status === "confirmed");

  const now = Date.now();
  const agingThreshold = now - AGING_DAYS * 24 * 60 * 60 * 1000;

  // Group not-yet-requested collected cash by partner, so Admin sees "this
  // partner is sitting on ₹X uncollected" rather than a raw order list.
  const byPartnerUncollected = new Map<string, { count: number; amount: number; oldest: string | null }>();
  for (const o of uncollectedDeposits ?? []) {
    const entry = byPartnerUncollected.get(o.delivery_partner_id) ?? { count: 0, amount: 0, oldest: null };
    entry.count += 1;
    entry.amount += Number(o.buyer_total);
    if (o.cod_collected_at && (!entry.oldest || o.cod_collected_at < entry.oldest)) entry.oldest = o.cod_collected_at;
    byPartnerUncollected.set(o.delivery_partner_id, entry);
  }
  const agingUncollected = Array.from(byPartnerUncollected.entries()).filter(
    ([, agg]) => agg.oldest && new Date(agg.oldest).getTime() < agingThreshold
  );

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-field">COD Cash Deposits</h1>
        <Link href="/admin/delivery-settlements" className="text-field underline text-sm">Delivery settlements →</Link>
      </div>
      <p className="text-soil/60 text-sm -mt-6">
        Delivery partners record here when they've handed over collected COD cash in person — confirm once you've
        actually counted and received it.
      </p>

      {agingUncollected.length > 0 && (
        <section>
          <h2 className="font-medium text-alert mb-3">
            Collected but not yet requested for deposit ({AGING_DAYS}+ days)
          </h2>
          <div className="flex flex-col gap-3">
            {agingUncollected.map(([partnerId, agg]) => (
              <div key={partnerId} className="card border-alert">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-soil">{nameById.get(partnerId) ?? "Delivery Partner"}</p>
                  <p className="font-medium text-alert">₹{agg.amount.toFixed(2)}</p>
                </div>
                <p className="text-soil/60 text-xs mt-1">
                  {phoneById.get(partnerId)} · {agg.count} order{agg.count === 1 ? "" : "s"} · oldest since{" "}
                  {agg.oldest ? new Date(agg.oldest).toLocaleDateString() : "unknown"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-medium text-field mb-3">Awaiting confirmation ({pending.length})</h2>
        {pending.length === 0 && <p className="text-soil/70">Nothing pending.</p>}
        <div className="flex flex-col gap-3">
          {pending.map((d) => {
            const overdue = new Date(d.created_at).getTime() < agingThreshold;
            return (
              <div key={d.id} className={`card ${overdue ? "border-alert" : "border-marigold"}`}>
                <div className="flex justify-between items-start">
                  <p className="font-medium text-soil">{nameById.get(d.delivery_partner_id) ?? "Delivery Partner"}</p>
                  <p className="font-medium text-field">₹{Number(d.amount).toFixed(2)}</p>
                </div>
                <p className="text-soil/60 text-xs mt-1">
                  {phoneById.get(d.delivery_partner_id)} · {d.order_ids.length} order{d.order_ids.length === 1 ? "" : "s"} ·
                  requested {new Date(d.created_at).toLocaleDateString()}
                  {overdue ? ` · overdue confirmation` : ""}
                </p>
                <ConfirmCodDepositButton depositId={d.id} />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-medium text-field mb-3">Confirmed history</h2>
        {confirmed.length === 0 && <p className="text-soil/70">No confirmed deposits yet.</p>}
        <div className="flex flex-col gap-3">
          {confirmed.map((d) => (
            <div key={d.id} className="card">
              <div className="flex justify-between items-start">
                <p className="font-medium text-soil">{nameById.get(d.delivery_partner_id) ?? "Delivery Partner"}</p>
                <p className="text-soil/70">₹{Number(d.amount).toFixed(2)}</p>
              </div>
              <p className="text-soil/60 text-xs mt-1">
                Confirmed {d.confirmed_at ? new Date(d.confirmed_at).toLocaleDateString() : ""}
                {d.note ? ` · ${d.note}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
