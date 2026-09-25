"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StartChatButton({
  listingId,
  farmerId,
  userId,
}: {
  listingId: string;
  farmerId: string;
  // Passed down from the server page (already verified by middleware.ts) so
  // this doesn't have to call auth.getUser() itself on every tap.
  userId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", userId)
      .maybeSingle();

    if (existing) {
      router.push(`/buyer/chat/${existing.id}`);
      return;
    }

    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert({ listing_id: listingId, farmer_id: farmerId, buyer_id: userId })
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
