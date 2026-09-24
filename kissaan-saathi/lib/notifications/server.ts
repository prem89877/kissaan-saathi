// SERVER-ONLY helper to create a notification from an API route / server action.
// (Everything that happens through your existing screens is already covered by
// the database triggers; use this only for something new that has no DB write.)
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export async function createNotification(input: {
  recipientId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  params?: Record<string, unknown>;
  orderId?: string;
  conversationId?: string;
  listingId?: string;
}) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("create_notification", {
    p_recipient: input.recipientId,
    p_type: input.type,
    p_title: input.title,
    p_message: input.message ?? "",
    p_link: input.link ?? null,
    p_params: input.params ?? {},
    p_order: input.orderId ?? null,
    p_conversation: input.conversationId ?? null,
    p_listing: input.listingId ?? null,
  });
  if (error) throw new Error("Could not create notification: " + error.message);
  return data as string | null;
}
