import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth/session";
import { getServerTranslator } from "@/lib/i18n/server";
import WithdrawButton from "@/components/WithdrawButton";
import Link from "next/link";

export default async function FarmerEarningsPage() {
  const supabase = createClient();
  // middleware.ts already verified this user for this exact request — reuse
  // that instead of calling supabase.auth.getUser() again here.
  const userId = await requireUserId();
  const { t } = getServerTranslator();

  const [{ data: pendingOrders }, { data: settlements }, { data: processingRequest }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, product_subtotal, seller_fee, seller_payout, payment_method, cod_cash_deposits(status)")
      .eq("farmer_id", userId)
      .in("status", ["delivered", "completed"])
      .is("settlement_id", null)
      .is("payout_request_id", null),
    supabase
      .from("farmer_settlements")
      .select("id, gross_amount, seller_fee, net_payable, amount_paid, utr_reference, payment_date, status, created_at")
      .eq("farmer_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("farmer_payout_requests")
      .select("id, source, eligible_amount, bonus_amount, total_amount, processing_until, created_at")
      .eq("farmer_id", userId)
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // COD cash must be deposited AND confirmed by Admin before it counts
  // toward this farmer's eligible balance — see
  // 22_link_cod_deposit_to_farmer_settlement.sql. Shown separately below so
  // it doesn't look like money silently vanished.
  const readyOrders = (pendingOrders ?? []).filter((o: any) => {
    if (o.payment_method !== "cod") return true;
    const depositStatus = Array.isArray(o.cod_cash_deposits) ? o.cod_cash_deposits[0]?.status : o.cod_cash_deposits?.status;
    return depositStatus === "confirmed";
  });
  const awaitingCodDeposit = (pendingOrders ?? []).filter((o: any) => {
    if (o.payment_method !== "cod") return false;
    const depositStatus = Array.isArray(o.cod_cash_deposits) ? o.cod_cash_deposits[0]?.status : o.cod_cash_deposits?.status;
    return depositStatus !== "confirmed";
  });

  const pendingCount = readyOrders.length;
  const pendingNet = readyOrders.reduce((sum, o) => sum + Number(o.seller_payout), 0);
  const awaitingCodNet = awaitingCodDeposit.reduce((sum, o) => sum + Number(o.seller_payout), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-field mb-1">{t("earnings.title")}</h1>
        <p className="text-soil/60 text-sm">{t("earnings.subtitle")}</p>
      </div>

      {processingRequest ? (
        <section className="card border-marigold">
          <h2 className="font-medium text-soil mb-2">
            {processingRequest.source === "auto_day16" ? t("earnings.autoSettledTitle") : t("earnings.withdrawalInProgress")}
          </h2>
          <p className="text-2xl font-display text-field">₹{Number(processingRequest.total_amount).toFixed(2)}</p>
          {Number(processingRequest.bonus_amount) > 0 && (
            <p className="text-field text-sm mt-1">
              {t("earnings.includesBonus").replace("{bonus}", Number(processingRequest.bonus_amount).toFixed(2))}
            </p>
          )}
          <p className="text-soil/60 text-xs mt-2">
            {t("earnings.adminWillPayBy").replace(
              "{date}",
              new Date(processingRequest.processing_until).toLocaleDateString()
            )}
          </p>
        </section>
      ) : (
        <section className="card border-field">
          <h2 className="font-medium text-field mb-2">{t("earnings.eligibleBalance")}</h2>
          <p className="text-3xl font-display text-field">₹{pendingNet.toFixed(2)}</p>
          <p className="text-soil/60 text-sm mt-1">
            {t("earnings.fromOrdersNotWithdrawn").replace("{count}", String(pendingCount))}
          </p>
          <p className="text-soil/50 text-xs mt-2 mb-3">{t("earnings.feeExplainer")}</p>
          <WithdrawButton eligibleAmount={pendingNet} />
          {awaitingCodDeposit.length > 0 && (
            <p className="text-soil/50 text-xs mt-3 pt-3 border-t border-soil/10">
              {t("earnings.awaitingCodNote")
                .replace("{amount}", awaitingCodNet.toFixed(2))
                .replace("{count}", String(awaitingCodDeposit.length))}
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="font-medium text-field mb-3">{t("earnings.settlementHistory")}</h2>
        {(!settlements || settlements.length === 0) && (
          <p className="text-soil/70">{t("earnings.noSettlements")}</p>
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
              <p className="text-soil/60 text-xs">
                {t("earnings.grossFeeNet")
                  .replace("{gross}", String(s.gross_amount))
                  .replace("{fee}", String(s.seller_fee))
                  .replace("{net}", String(s.net_payable))}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/farmer/profile" className="text-field underline text-sm">{t("earnings.backToProfile")}</Link>
    </div>
  );
}
