import OrderSummaryPanel from "@/components/OrderSummaryPanel";

export default function BuyerOrderSummaryPage({ params }: { params: { id: string } }) {
  return <OrderSummaryPanel conversationId={params.id} />;
}
