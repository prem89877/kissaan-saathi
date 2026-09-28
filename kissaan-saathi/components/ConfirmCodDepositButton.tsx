"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmCodDepositButton({ depositId }: { depositId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("confirm_cod_deposit", {
      p_deposit_id: depositId,
      p_note: note.trim() || null,
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      {error && <p className="text-alert text-sm">{error}</p>}
      <input
        className="input-field"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button onClick={handleConfirm} disabled={loading} className="btn-primary">
        {loading ? "Confirming…" : "Confirm cash received"}
      </button>
    </div>
  );
}
