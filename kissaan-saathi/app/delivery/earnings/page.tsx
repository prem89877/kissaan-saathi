import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { getServerTranslator } from "@/lib/i18n/server";
import DepositCodCashButton from "@/components/DepositCodCashButton";
import Link from "next/link";

export default async function DeliveryEarningsPage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();
  const { t } = getServerTranslator();

  const [{ data: pendingOrders }, { data: settlements }, { data: uncollectedCod }, { data: deposits }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, delivery_cost, delivery_partner_earning")
        .eq("delivery_partner_id", userId)
        .eq("delivery_mode", "delivery")
        .in("status", ["delivered", "completed"])
        .is("delivery_settlement_id", null),
      supabase
        .from("delivery_settlements")
        .select("id, gross_amount, net_payable, amount_paid, utr_reference, payment_date, status, created_at")
        .eq("delivery_partner_id", userId)
        .order("created_at", { ascending: false }),
      // Cash already collected from buyers but not yet claimed by a deposit
      // request — see 21_cod_deposit_reconciliation.sql.
      supabase
        .from("orders")
        .select("id, buyer_total")
        .eq("delivery_partner_id", userId)
        .eq("payment_method", "cod")
        .eq("payment_status", "cod_collected")
        .is("cod_deposit_id", null),
      supabase
        .from("cod_cash_deposits")
        .select("id, amount, status, note, created_at, confirmed_at")
        .eq("delivery_partner_id", userId)
        .order("created_at", { ascending: false }),
    ]);

  const pendingCount = pendingOrders?.length ?? 0;
  const pendingNet = (pendingOrders ?? []).reduce(
    (sum, o) => sum + Number(o.delivery_partner_earning ?? o.delivery_cost),
    0
  );
  const cashInHand = (uncollectedCod ?? []).reduce((sum, o) => sum + Number(o.buyer_total), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-field mb-1">{t("deliveryEarnings.title")}</h1>
        <p className="text-soil/60 text-sm">{t("deliveryEarnings.subtitle")}</p>
      </div>

      <section className="card border-field">
        <h2 className="font-medium text-field mb-2">{t("deliveryEarnings.pendingTitle")}</h2>
        <p className="text-3xl font-display text-field">₹{pendingNet.toFixed(2)}</p>
        <p className="text-soil/60 text-sm mt-1">
          {t("deliveryEarnings.pendingNote").replace("{count}", String(pendingCount))}
        </p>
      </section>

      <section className="card border-marigold">
        <h2 className="font-medium text-soil mb-2">{t("deliveryEarnings.cashInHandTitle")}</h2>
        <p className="text-3xl font-display text-marigold-dark">₹{cashInHand.toFixed(2)}</p>
        <p className="text-soil/60 text-sm mt-1">{t("deliveryEarnings.cashInHandNote")}</p>
        {cashInHand > 0 && <DepositCodCashButton />}
      </section>

      {deposits && deposits.length > 0 && (
        <section>
          <h2 className="font-medium text-field mb-3">{t("deliveryEarnings.depositsTitle")}</h2>
          <div className="flex flex-col gap-3">
            {deposits.map((d) => (
              <div key={d.id} className="card">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-soil">₹{Number(d.amount).toFixed(2)}</p>
                  <span
                    className={`text-xs rounded-full px-2 py-1 ${
                      d.status === "confirmed" ? "bg-field/10 text-field" : "bg-marigold/20 text-marigold-dark"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
                <p className="text-soil/60 text-xs mt-1">
                  {t("deliveryEarnings.requestedOn").replace("{date}", new Date(d.created_at).toLocaleDateString())}
                  {d.confirmed_at
                    ? ` · ${t("deliveryEarnings.confirmedOn").replace("{date}", new Date(d.confirmed_at).toLocaleDateString())}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-medium text-field mb-3">{t("deliveryEarnings.settlementHistory")}</h2>
        {(!settlements || settlements.length === 0) && (
          <p className="text-soil/70">{t("deliveryEarnings.noSettlements")}</p>
        )}
        <div className="flex flex-col gap-3">
          {settlements?.map((s) => (
            <div key={s.id} className="card">
              <div className="flex justify-between items-start">
                <p className="font-medium text-soil">₹{s.amount_paid}</p>
                <span className="text-xs bg-field/10 text-field rounded-full px-2 py-1">{s.status}</span>
              </div>
              <p className="text-soil/70 text-sm mt-1">{t("earnings.paidOn").replace("{date}", String(s.payment_date))}</p>
              <p className="text-soil/60 text-xs mt-1">{t("earnings.utr")}: {s.utr_reference}</p>
              <p className="text-soil/60 text-xs">{t("deliveryEarnings.netAmount").replace("{net}", String(s.net_payable))}</p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/delivery/profile" className="text-field underline text-sm">{t("deliveryEarnings.backToProfile")}</Link>
    </div>
  );
}
