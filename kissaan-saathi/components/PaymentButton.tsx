"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export default function PaymentButton({
  orderId,
  amount,
  buyerName,
  buyerEmail,
}: {
  orderId: string;
  amount: number;
  buyerName?: string;
  buyerEmail?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const createRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        setError(createData.error ?? "Could not start payment.");
        setLoading(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Could not load the payment widget. Check your connection and try again.");
        setLoading(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: createData.key_id,
        amount: createData.amount,
        currency: createData.currency,
        order_id: createData.razorpay_order_id,
        name: "Kissaan Saathi",
        description: "Order payment",
        prefill: { name: buyerName, email: buyerEmail },
        handler: async (response: RazorpaySuccessResponse) => {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, ...response }),
          });
          const verifyData = await verifyRes.json();
          setLoading(false);
          if (!verifyRes.ok) {
            setError(verifyData.error ?? "Payment verification failed.");
            return;
          }
          router.refresh();
        },
        modal: { ondismiss: () => setLoading(false) },
      });

      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong starting payment.");
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="text-alert text-sm mb-2">{error}</p>}
      <button onClick={handlePay} disabled={loading} className="btn-primary w-full">
        {loading ? "Opening payment…" : `Pay ₹${amount} — Online / UPI`}
      </button>
    </div>
  );
}
