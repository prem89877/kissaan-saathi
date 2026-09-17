"use client";

import { useState } from "react";
import DisputeForm from "./DisputeForm";

export default function DisputeButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);

  if (open) return <DisputeForm orderId={orderId} onCancel={() => setOpen(false)} />;

  return (
    <button onClick={() => setOpen(true)} className="btn-secondary border-alert text-alert w-full">
      Report a problem
    </button>
  );
}
