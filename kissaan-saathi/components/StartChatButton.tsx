"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StartChatButton({
  listingId,
  farmerId,
}: {
  listingId: string;
  farmerId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Please log in again.");
      setLoading(false);
      return;
    }

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (existing) {
      router.push(`/buyer/chat/${existing.id}`);
      return;
    }

    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert({ listing_id: listingId, farmer_id: farmerId, buyer_id: user.id })
      .select("id")
      .single();

    setLoading(false);

    if (createError || !created) {
      setError("Could not start the conversation: " + (createError?.message ?? "unknown error"));
      return;
    }

    router.push(`/buyer/chat/${created.id}`);
  }

  return (
    <div>
      {error && <p className="text-alert text-sm mb-2">{error}</p>}
      <button onClick={handleClick} disabled={loading} className="btn-secondary w-full">
        {loading ? "Opening chat…" : "Negotiate with farmer"}
      </button>
    </div>
  );
}
