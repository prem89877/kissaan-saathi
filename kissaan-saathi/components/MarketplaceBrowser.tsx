"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type MarketplaceListing = {
  id: string;
  name: string;
  price_per_kg: number;
  available_qty: number;
  moq: number;
  grade: string | null;
  harvest_date: string | null;
  category_name: string | null;
  farmer_name: string | null;
  distance_km: number | null;
  thumb_url: string | null;
};

type Category = { id: string; name: string };

export default function MarketplaceBrowser({
  listings,
  categories,
}: {
  listings: MarketplaceListing[];
  categories: Category[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [maxDistance, setMaxDistance] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<"distance" | "price" | "newest">("distance");

  const filtered = useMemo(() => {
    let result = listings.filter((l) => {
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${l.name} ${l.category_name ?? ""} ${l.farmer_name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (category && l.category_name !== category) return false;
      if (maxDistance && (l.distance_km == null || l.distance_km > parseFloat(maxDistance))) return false;
      if (maxPrice && l.price_per_kg > parseFloat(maxPrice)) return false;
      return true;
    });

    if (sortBy === "distance") {
      result = [...result].sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
    } else if (sortBy === "price") {
      result = [...result].sort((a, b) => a.price_per_kg - b.price_per_kg);
    }
    // "newest" keeps the incoming order (already sorted by created_at desc from the query)

    return result;
  }, [listings, query, category, maxDistance, maxPrice, sortBy]);

  return (
    <div>
      <input
        placeholder="Search product, category or farmer"
        className="input-field mb-3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <select className="input-field w-auto text-sm py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select
          className="input-field w-auto text-sm py-2"
          value={maxDistance}
          onChange={(e) => setMaxDistance(e.target.value)}
        >
          <option value="">Any distance</option>
          <option value="10">Within 10 km</option>
          <option value="30">Within 30 km</option>
          <option value="70">Within 70 km</option>
        </select>
        <input
          type="number"
          placeholder="Max ₹/kg"
          className="input-field w-28 text-sm py-2"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
        <select
          className="input-field w-auto text-sm py-2"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="distance">Nearest first</option>
          <option value="price">Lowest price first</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      <p className="text-soil/60 text-sm mb-3">{filtered.length} listing(s)</p>

      {filtered.length === 0 && (
        <p className="text-soil/70">No listings match your search right now.</p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((l) => (
          <Link key={l.id} href={`/buyer/product/${l.id}`} className="card flex gap-3">
            {l.thumb_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.thumb_url} alt="" className="w-16 h-16 object-cover rounded-card flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <p className="font-medium text-soil">{l.name}</p>
                {l.distance_km != null && (
                  <span className="text-xs text-soil/60 whitespace-nowrap">~{l.distance_km} km</span>
                )}
              </div>
              <p className="text-soil/70 text-sm mt-1">
                ₹{l.price_per_kg}/kg · MOQ {l.moq} kg · {l.available_qty} kg available
              </p>
              <p className="text-soil/60 text-xs mt-1">
                {l.farmer_name}{l.grade ? ` · Grade ${l.grade}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
