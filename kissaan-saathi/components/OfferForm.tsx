"use client";

import { useState } from "react";

export default function OfferForm({
  initialQuantity,
  initialPrice,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initialQuantity: number;
  initialPrice: number;
  onSubmit: (quantity: number, price: number) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [price, setPrice] = useState(String(initialPrice));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = parseFloat(quantity);
    const p = parseFloat(price);
    if (!(q > 0)) return setError("Quantity must be a positive number.");
    if (!(p > 0)) return setError("Price must be a positive number.");
    setError(null);
    onSubmit(q, p);
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
      {error && <p className="text-alert text-sm">{error}</p>}
      <label className="text-sm text-soil/70">
        Quantity (kg)
        <input type="number" min="0.01" step="0.01" className="input-field mt-1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>
      <label className="text-sm text-soil/70">
        Price per kg (₹)
        <input type="number" min="0.01" step="0.01" className="input-field mt-1" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1">{submitLabel}</button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
      </div>
    </form>
  );
}
