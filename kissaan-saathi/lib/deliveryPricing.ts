export type DeliveryPricingConfig = {
  minimum_charge: number;
  rate_per_km: number;
  round_trip_factor: number;
  weight_rate_per_kg: number;
};

// Mirrors calculate_delivery_cost() in 06_delivery_pricing.sql. This copy is
// for showing an illustrative estimate before an order exists; the amount
// that's actually charged is always computed server-side, in that SQL
// function, at order-creation time — never trusted from this file.
export function calculateDeliveryCost(
  distanceKm: number | null,
  quantityKg: number,
  config: DeliveryPricingConfig
): number {
  const distance = distanceKm ?? 0;
  const raw = distance * config.rate_per_km * config.round_trip_factor + quantityKg * config.weight_rate_per_kg;
  return Math.max(config.minimum_charge, Math.round(raw * 100) / 100);
}

export function configFromRows(rows: { key: string; value: number }[] | null): DeliveryPricingConfig {
  const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
  return {
    minimum_charge: map.get("minimum_charge") ?? 100,
    rate_per_km: map.get("rate_per_km") ?? 8,
    round_trip_factor: map.get("round_trip_factor") ?? 2,
    weight_rate_per_kg: map.get("weight_rate_per_kg") ?? 0.5,
  };
}
