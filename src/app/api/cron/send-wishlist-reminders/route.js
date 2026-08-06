import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;

const vapidConfigured = Boolean(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
);

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@roopsee.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const queryToken = new URL(request.url).searchParams.get("secret") || "";

  return bearerToken === secret || queryToken === secret;
}

function reminderMessage(reminder) {
  const productPhrase = reminder.product_name ? `"${reminder.product_name}" is` : "Your saved picks are";
  return {
    title: "Your cart is waiting",
    body: `${productPhrase} still in your wishlist — visit Roopsee to checkout.`,
    url: "/wishlist",
    tag: "wishlist-reminder",
  };
}

async function loadDueReminders() {
  const { data, error } = await supabaseAdmin
    .from("wishlist_reminders")
    .select("id, visitor_id, product_uid, product_name")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) throw error;
  return data || [];
}

async function loadSubscriptions(visitorIds) {
  if (!visitorIds.length) return new Map();

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, visitor_id, endpoint, p256dh, auth_key")
    .in("visitor_id", visitorIds)
    .eq("disabled", false);

  if (error) throw error;

  const byVisitor = new Map();
  for (const row of data || []) {
    if (!byVisitor.has(row.visitor_id)) byVisitor.set(row.visitor_id, []);
    byVisitor.get(row.visitor_id).push(row);
  }
  return byVisitor;
}

async function sendToSubscription(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (error) {
    const expired = error.statusCode === 404 || error.statusCode === 410;
    if (expired) {
      await supabaseAdmin.from("push_subscriptions").update({ disabled: true }).eq("id", subscription.id);
    }
    return { ok: false, expired, statusCode: error.statusCode };
  }
}

async function handleCronRequest(request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!vapidConfigured) {
    return Response.json({ error: "VAPID keys are not configured" }, { status: 500 });
  }

  try {
    const reminders = await loadDueReminders();
    if (!reminders.length) {
      return Response.json({ ok: true, processed: 0, sent: 0, failed: 0 });
    }

    const visitorIds = [...new Set(reminders.map((reminder) => reminder.visitor_id))];
    const subscriptionsByVisitor = await loadSubscriptions(visitorIds);

    let sent = 0;
    let failed = 0;

    for (const reminder of reminders) {
      const subscriptions = subscriptionsByVisitor.get(reminder.visitor_id) || [];
      if (!subscriptions.length) {
        failed += 1;
        await supabaseAdmin
          .from("wishlist_reminders")
          .update({ status: "failed", failure_reason: "no_subscription" })
          .eq("id", reminder.id);
        continue;
      }

      const payload = reminderMessage(reminder);
      const results = await Promise.all(
        subscriptions.map((subscription) => sendToSubscription(subscription, payload)),
      );
      const delivered = results.some((result) => result.ok);

      if (delivered) {
        sent += 1;
        await supabaseAdmin
          .from("wishlist_reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
      } else {
        failed += 1;
        await supabaseAdmin
          .from("wishlist_reminders")
          .update({ status: "failed", failure_reason: "delivery_failed" })
          .eq("id", reminder.id);
      }
    }

    return Response.json({ ok: true, processed: reminders.length, sent, failed });
  } catch (error) {
    console.error("[api/cron/send-wishlist-reminders] Failed:", error.message);
    return Response.json({ error: "Reminder send failed" }, { status: 500 });
  }
}

export async function GET(request) {
  return handleCronRequest(request);
}

export async function POST(request) {
  return handleCronRequest(request);
}
