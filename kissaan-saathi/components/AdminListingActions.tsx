"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Action = "approve" | "reject" | "request_changes" | "suspend";

const REASON_REQUIRED: Action[] = ["reject", "request_changes", "suspend"];

const LABELS: Record<Action, string> = {
  approve: "Approve",
  reject: "Reject",
  request_changes: "Request changes",
  suspend: "Suspend",
};

const NEW_STATUS: Record<Action, string> = {
  approve: "approved",
  reject: "rejected",
  request_changes: "changes_requested",
  suspend: "suspended",
};

export default function AdminListingActions({
  listingId,
  photoCount,
}: {
  listingId: string;
  photoCount: number;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function startAction(action: Action) {
    setError(null);
    setReason("");
    setPendingAction(action);
  }

  async function confirmAction() {
    if (!pendingAction) return;
    if (REASON_REQUIRED.includes(pendingAction) && !reason.trim()) {
      setError("Please provide a reason — the farmer will see this.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from("product_listings")
      .update({
        status: NEW_STATUS[pendingAction],
        admin_reviewed: pendingAction === "approve" ? true : undefined,
        rejection_reason: REASON_REQUIRED.includes(pendingAction) ? reason.trim() : null,
      })
      .eq("id", listingId);

    if (updateError) {
      // Most common cause: trying to Approve with fewer than 10 photos —
      // the database trigger blocks that and raises this exact message.
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    await supabase.from("listing_reviews").insert({
      listing_id: listingId,
      admin_id: user!.id,
      action: pendingAction,
      reason: REASON_REQUIRED.includes(pendingAction) ? reason.trim() : null,
    });

    await supabase.from("admin_actions").insert({
      admin_id: user!.id,
      action: `listing_${pendingAction}`,
      target_table: "product_listings",
      target_id: listingId,
      metadata: reason ? { reason } : {},
    });

    setSubmitting(false);
    setPendingAction(null);
    router.push("/admin/listings");
    router.refresh();
  }

  if (pendingAction) {
    return (
      <div className="card border-field">
        <p className="font-medium text-soil mb-2">{LABELS[pendingAction]}</p>
        {pendingAction === "approve" && photoCount < 10 && (
          <p className="text-alert text-sm mb-3">
            This listing has only {photoCount} photo(s). Approval will be blocked until it has at least 10.
          </p>
        )}
        {REASON_REQUIRED.includes(pendingAction) && (
          <textarea
            className="input-field min-h-[80px] mb-3"
            placeholder="Reason (visible to the farmer)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        {error && <p className="text-alert text-sm mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={confirmAction} disabled={submitting} className="btn-primary flex-1">
            {submitting ? "Saving…" : `Confirm ${LABELS[pendingAction].toLowerCase()}`}
          </button>
          <button onClick={() => setPendingAction(null)} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={() => startAction("approve")} className="btn-primary">Approve</button>
      <button onClick={() => startAction("reject")} className="btn-secondary">Reject</button>
      <button onClick={() => startAction("request_changes")} className="btn-secondary">Request changes</button>
      <button onClick={() => startAction("suspend")} className="btn-secondary">Suspend</button>
    </div>
  );
}
