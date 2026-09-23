import PendingOfferPanel from "@/components/PendingOfferPanel";

export default function FarmerPendingOfferPage({ params }: { params: { offerId: string } }) {
  return <PendingOfferPanel offerId={params.offerId} />;
}
