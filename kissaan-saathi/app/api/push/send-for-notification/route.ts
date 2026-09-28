import { NextResponse } from "next/server";
import webpush from "web-push";
import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

// Called by the DB trigger in 20_web_push.sql (via pg_net) right after any
// row is inserted into `notifications` — NOT called by the browser. Auth is
// a shared secret header, not a user session, since Postgres is the caller.
//
// Despite the folder name (kept as-is from when this only did push), this
// route now dispatches BOTH web push and email for one notification — one
// DB trigger, one webhook call, two channels — rather than adding a second
// pg_net trigger for email. Each channel is independently optional: if only
// VAPID keys are set, push works and email is skipped; if only Resend is
// set, vice versa; if neither, this just no-ops.
export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notification_id } = await request.json();
  if (!notification_id) {
    return NextResponse.json({ error: "notification_id is required" }, { status: 400 });
  }

  const service = createServiceRoleClient();

  const { data: notification } = await service
    .from("notifications")
    .select("id, recipient_id, title, message, link")
    .eq("id", notification_id)
    .single();

  if (!notification) {
    return NextResponse.json({ skipped: "notification_not_found" });
  }

  const [pushResult, emailResult] = await Promise.all([
    sendPush(service, notification),
    sendEmail(service, notification),
  ]);

  return NextResponse.json({ push: pushResult, email: emailResult });
}

async function sendPush(
  service: ReturnType<typeof createServiceRoleClient>,
  notification: { id: string; recipient_id: string; title: string; message: string; link: string | null }
) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return { skipped: "vapid_not_configured" };
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { data: subscriptions } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notification.recipient_id);

  if (!subscriptions || subscriptions.length === 0) return { sent: 0 };

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    link: notification.link || "/",
  });

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent += 1;
      } catch (err: any) {
        // 404/410 = the browser unsubscribed or the subscription expired —
        // clean it up so we stop trying. Any other error, leave it alone
        // (could be transient).
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await service.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );

  return { sent };
}

async function sendEmail(
  service: ReturnType<typeof createServiceRoleClient>,
  notification: { id: string; recipient_id: string; title: string; message: string; link: string | null }
) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !fromAddress) {
    return { skipped: "email_not_configured" };
  }

  const { data: recipient } = await service
    .from("profiles")
    .select("email, email_notifications_enabled")
    .eq("id", notification.recipient_id)
    .single();

  if (!recipient?.email) return { skipped: "no_email_on_file" };
  if (recipient.email_notifications_enabled === false) return { skipped: "opted_out" };

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://kissaan-saathi.vercel.app").replace(/\/$/, "");
  const link = notification.link ? `${appUrl}${notification.link}` : appUrl;
  const supportEmail = process.env.SUPPORT_EMAIL || fromAddress;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromAddress,
      to: recipient.email,
      subject: notification.title,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1F4D36;">${escapeHtml(notification.title)}</h2>
          <p style="color: #5B4636;">${escapeHtml(notification.message)}</p>
          <p><a href="${link}" style="color: #E3A008;">Open in Kissaan Saathi →</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">
            Questions? Contact us at ${escapeHtml(supportEmail)}. You can turn off email notifications
            anytime from your profile page.
          </p>
        </div>
      `,
    });
    return { sent: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "unknown_error" };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
