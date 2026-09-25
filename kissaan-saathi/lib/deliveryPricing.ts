// Tiered delivery pricing. Mirrors calculate_buyer_delivery_fee() and
// calculate_delivery_partner_earning() in 14_delivery_pricing_tiers.sql.
// This copy is for showing an illustrative estimate before an order exists;
// the amount actually charged/paid is always computed server-side, in those
// SQL functions, at order-creation time — never trusted from this file.
//
// NOTE: `distanceKm` here is whatever lib/distance.ts gives you today, which
// is straight-line (haversine) distance, not real road distance. The slabs
// below are written as if the input is one-way road distance, per the brief —
// swap in a routing-based distance source if/when one is wired up; nothing
// else here needs to change.

export type DistanceTier = { minKm: number; maxKm: number; amount: number };

// Buyer-facing delivery fee by one-way distance.
export const BUYER_DISTANCE_FEE_TIERS: DistanceTier[] = [
  { minKm: 0, maxKm: 2, amount: 20 },
  { minKm: 2, maxKm: 5, amount: 30 },
  { minKm: 5, maxKm: 10, amount: 45 },
  { minKm: 10, maxKm: 15, amount: 60 },
  { minKm: 15, maxKm: 20, amount: 80 },
  { minKm: 20, maxKm: 30, amount: 110 },
];

// Delivery partner earning by one-way distance.
export const PARTNER_DISTANCE_EARNING_TIERS: DistanceTier[] = [
  { minKm: 0, maxKm: 2, amount: 15 },
  { minKm: 2, maxKm: 5, amount: 22 },
  { minKm: 5, maxKm: 10, amount: 35 },
  { minKm: 10, maxKm: 15, amount: 45 },
  { minKm: 15, maxKm: 20, amount: 60 },
  { minKm: 20, maxKm: 30, amount: 80 },
];

export const WEIGHT_FREE_LIMIT_KG = 30;
export const WEIGHT_EXTRA_RATE_PER_KG = 2;

function tierAmount(distanceKm: number, tiers: DistanceTier[]): number {
  const d = Math.max(0, distanceKm);
  for (const t of tiers) {
    if (d > t.minKm && d <= t.maxKm) return t.amount;
  }
  if (d === 0) return tiers[0].amount; // treat 0 km as the first slab
  // Beyond the last defined slab (>30 km): no slab covers this by the brief.
  // Falling back to the top slab so nothing silently charges ₹0 — flag this
  // for review if orders start regularly exceeding 30 km.
  return tiers[tiers.length - 1].amount;
}

export function calculateWeightFee(weightKg: number): number {
  const extra = Math.max(0, weightKg - WEIGHT_FREE_LIMIT_KG);
  return Math.round(extra * WEIGHT_EXTRA_RATE_PER_KG * 100) / 100;
}

export function calculateBuyerDeliveryFee(distanceKm: number | null, weightKg: number): number {
  const distanceFee = tierAmount(distanceKm ?? 0, BUYER_DISTANCE_FEE_TIERS);
  return Math.round((distanceFee + calculateWeightFee(weightKg)) * 100) / 100;
}

export function calculateDeliveryPartnerEarning(distanceKm: number | null): number {
  return tierAmount(distanceKm ?? 0, PARTNER_DISTANCE_EARNING_TIERS);
}

export function calculatePlatformMargin(buyerDeliveryFee: number, deliveryPartnerEarning: number): number {
  return Math.round((buyerDeliveryFee - deliveryPartnerEarning) * 100) / 100;
}

// When one delivery partner is covering multiple orders on the same route in
// one trip, don't pay the full per-order earning for each — split a single
// trip earning across the orders instead. Split basis: each order's share of
// the total weight carried on that trip (heavier order = bigger share of the
// payout). `tripEarning` should be the earning for the trip's route distance,
// e.g. calculateDeliveryPartnerEarning(furthest stop's distance).
// Adjust the basis here if you'd rather split evenly or by each order's own
// distance instead of by weight.
export function splitPartnerEarningAcrossOrders(
  orders: { id: string; weightKg: number }[],
  tripEarning: number
): { id: string; earning: number }[] {
  const totalWeight = orders.reduce((sum, o) => sum + o.weightKg, 0);
  if (orders.length === 0) return [];
  if (totalWeight <= 0) {
    const equalShare = Math.round((tripEarning / orders.length) * 100) / 100;
    const shares = orders.map((o) => ({ id: o.id, earning: equalShare }));
    const allocated = equalShare * (orders.length - 1);
    shares[shares.length - 1].earning = Math.round((tripEarning - allocated) * 100) / 100;
    return shares;
  }

  const shares = orders.map((o) => ({
    id: o.id,
    earning: Math.round(((o.weightKg / totalWeight) * tripEarning) * 100) / 100,
  }));
  const allocated = shares.slice(0, -1).reduce((sum, s) => sum + s.earning, 0);
  shares[shares.length - 1].earning = Math.round((tripEarning - allocated) * 100) / 100;
  return shares;
}
