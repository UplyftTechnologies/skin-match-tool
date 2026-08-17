import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A sweep of up to BATCH_LIMIT reminders does several sequential writes each,
// which can exceed Vercel's 10s default for a serverless function.
export const maxDuration = 60;

const BATCH_LIMIT = 100;

/**
 * Driven by the Vercel Cron entry in vercel.json. Vercel calls the production
 * deployment on schedule and attaches `Authorization: Bearer $CRON_SECRET`
 * automatically — but only when CRON_SECRET is set on the project, otherwise it
 * sends no auth header at all and every run 401s here.
 *
 * Configured lazily rather than at module scope so a missing key reports which
 * variable is absent, and so setting one takes effect on the next cold start.
 */
let vapidReady = false;

function vapidPublicKey() {
  // Prefer the server-only variable. NEXT_PUBLIC_* values are inlined into the
  // bundle AT BUILD TIME, so relying on the public one alone means adding it in
  // the Vercel dashboard has no effect until you redeploy — which reads exactly
  // like "push silently stopped working after deployment".
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
}

function missingVapidVars() {
  const missing = [];
  if (!vapidPublicKey()) missing.push("VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY)");
  if (!process.env.VAPID_PRIVATE_KEY) missing.push("VAPID_PRIVATE_KEY");
  return missing;
}

function ensureVapid() {
  if (vapidReady) return true;
  if (missingVapidVars().length) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@roopsee.com",
    vapidPublicKey(),
    process.env.VAPID_PRIVATE_KEY,
  );
  vapidReady = true;
  return true;
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[api/cron/send-wishlist-reminders] CRON_SECRET is not set — every run will 401");
    return false;
  }

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
  if (!ensureVapid()) {
    const missing = missingVapidVars();
    console.error("[api/cron/send-wishlist-reminders] missing VAPID config:", missing.join(", "));
    return Response.json(
      { error: "VAPID keys are not configured", missing },
      { status: 500 },
    );
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
