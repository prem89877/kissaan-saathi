// Client-side helpers for the notification system (browser Supabase client).
// Row Level Security already limits every query here to the signed-in user's
// own notifications, so no user id has to be passed in.

import { createClient } from "@/lib/supabase/client";

export type NotificationItem = {
  id: string;
  type: string;
  title: string; // English fallback written by the database
  message: string; // English fallback written by the database
  params: Record<string, string | number | null | undefined>;
  link: string | null;
  event_count: number;
  is_read: boolean;
  created_at: string;
  related_order_id: string | null;
  related_conversation_id: string | null;
  related_listing_id: string | null;
  related_offer_id: string | null;
  related_dispute_id: string | null;
};

export const NOTIFICATION_COLUMNS =
  "id, type, title, message, params, link, event_count, is_read, created_at, related_order_id, related_conversation_id, related_listing_id, related_offer_id, related_dispute_id";

// Get notifications (newest first).
export async function getNotifications(limit = 200): Promise<NotificationItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as NotificationItem[];
}

// Mark one notification as read.
export async function markAsRead(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

// Mark several as read in one request.
export async function markManyAsRead(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  if (error) throw error;
}

// Mark all of the signed-in user's unread notifications as read.
export async function markAllAsRead() {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  if (error) throw error;
}

// "Create notification" and "unread count":
//  - Creating is done by database triggers (sql/11_notifications.sql) so it can't be skipped
//    or faked from the browser. Server code can still create one: lib/notifications/server.ts.
//  - The unread count is `unreadCount` from useNotifications() (NotificationProvider).
