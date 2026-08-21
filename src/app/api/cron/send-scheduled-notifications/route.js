// Walks every subscriber through the onboarding drip in src/lib/push/messages.js.
//
// Each device gets messages relative to when IT subscribed, so this runs
// frequently and sends very little: on most passes nothing is due.
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";
import { dueMessages, NOTIFICATION_MESSAGES } from "@/lib/push/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 500;

// A subscriber whose messages are all overdue — because they subscribed before
// the drip existed, or the cron was down — would otherwise receive one every
// time this runs, i.e. every 15 minutes. Catching up is fine; catching up at
// four notifications an hour is how people disable notifications for good.
const MIN_GAP_HOURS = 4;

// Nobody wants a skincare tip at 3am. Times are IST, which is where the
// audience is; a message that comes due overnight simply waits for morning
// rather than being skipped.
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 8;
const IST_OFFSET_MINUTES = 330;

function istHour(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MINUTES * 60000).getUTCHours();
}

function inQuietHours(now = new Date()) {
  const hour = istHour(now);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

function vapidPublicKey() {
  return (
    (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim() ||
    (process.env.VAPID_PUBLIC_KEY || "").trim()
  );
}

let vapidReady = false;
function configureVapid() {
  if (vapidReady) return true;
  const publicKey = vapidPublicKey();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@roopsee.com",
    publicKey,
    privateKey,
  );
  vapidReady = true;
  return true;
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/send-scheduled-notifications] CRON_SECRET is not set — every run will 401");
    return false;
  }
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const query = new URL(request.url).searchParams.get("token") || "";
  return bearer === secret || query === secret;
}

// Claims a message by writing the log row first. If another run already
// claimed it the unique constraint rejects this insert, and we skip — so a
// message is delivered at most once even with overlapping cron invocations.
async function claim(visitorId, messageId) {
  const { error } = await supabaseAdmin
    .from("push_message_log")
    .insert({ visitor_id: visitorId, message_id: messageId });
  if (!error) return true;
  if (error.code === "23505") return false; // already claimed
  throw error;
}

async function releaseFailed(visitorId, messageId, reason) {
  // A transport failure should not permanently consume the message — mark it
  // failed and remove the claim so a later run can retry.
  await supabaseAdmin
    .from("push_message_log")
    .delete()
    .eq("visitor_id", visitorId)
    .eq("message_id", messageId);
  console.error("[cron/send-scheduled-notifications] send failed", { visitorId, messageId, reason });
}

async function handle(request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!configureVapid()) {
    return Response.json({ error: "VAPID keys are not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "1";
  const ignoreQuietHours = searchParams.get("force") === "1";
  // Testing only — lets a run deliver back-to-back messages to one person.
  const ignoreMinGap = searchParams.get("nogap") === "1";

  if (inQuietHours() && !ignoreQuietHours) {
    return Response.json({
      skipped: "quiet hours",
      istHour: istHour(),
      window: `${QUIET_START_HOUR}:00–${QUIET_END_HOUR}:00 IST`,
    });
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, visitor_id, endpoint, p256dh, auth_key, created_at")
    .eq("disabled", false)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[cron/send-scheduled-notifications] load failed:", error.message);
    return Response.json({ error: "Unable to load subscriptions" }, { status: 500 });
  }
  if (!subscriptions?.length) {
    return Response.json({ subscriptions: 0, sent: 0, note: "nobody subscribed" });
  }

  const visitorIds = [...new Set(subscriptions.map((row) => row.visitor_id))];
  const { data: logRows, error: logError } = await supabaseAdmin
    .from("push_message_log")
    .select("visitor_id, message_id, sent_at")
    .in("visitor_id", visitorIds);
  if (logError) {
    console.error("[cron/send-scheduled-notifications] log load failed:", logError.message);
    // A missing table is a setup step, not a runtime fault — say which one,
    // rather than leaving a generic 500 to be guessed at.
    const missingTable =
      logError.code === "42P01" || /does not exist|Could not find the table/i.test(logError.message);
    return Response.json(
      {
        error: missingTable
          ? "push_message_log table is missing — run supabase/migrations/0002_scheduled_notifications.sql in the Supabase SQL editor."
          : "Unable to load message log",
        detail: logError.message,
      },
      { status: missingTable ? 503 : 500 },
    );
  }

  const sentByVisitor = new Map();
  const lastSentByVisitor = new Map();
  for (const row of logRows || []) {
    if (!sentByVisitor.has(row.visitor_id)) sentByVisitor.set(row.visitor_id, []);
    sentByVisitor.get(row.visitor_id).push(row.message_id);

    const at = new Date(row.sent_at).getTime();
    if (at > (lastSentByVisitor.get(row.visitor_id) || 0)) {
      lastSentByVisitor.set(row.visitor_id, at);
    }
  }

  // Work per person, not per device. The log is keyed on (visitor, message),
  // so iterating subscriptions would let one device claim the message and
  // leave a second device on the same account silently skipped. A person
  // advances through the drip once and receives each message on every device
  // they have registered.
  const devicesByVisitor = new Map();
  for (const subscription of subscriptions) {
    if (!devicesByVisitor.has(subscription.visitor_id)) {
      devicesByVisitor.set(subscription.visitor_id, []);
    }
    devicesByVisitor.get(subscription.visitor_id).push(subscription);
  }

  let sent = 0;
  let failed = 0;
  let throttled = 0;
  const planned = [];

  for (const [visitorId, devices] of devicesByVisitor) {
    // Drip position follows the person's OLDEST device, so adding a second
    // phone later does not restart them at "Welcome".
    const subscribedAt = devices
      .map((device) => device.created_at)
      .sort()[0];

    const due = dueMessages(subscribedAt, sentByVisitor.get(visitorId) || []);
    // Only the oldest outstanding message per run. Someone away for two weeks
    // catches up one step at a time instead of receiving six notifications at
    // once.
    const message = due[0];
    if (!message) continue;

    const lastSent = lastSentByVisitor.get(visitorId);
    if (lastSent && Date.now() - lastSent < MIN_GAP_HOURS * 3600000 && !ignoreMinGap) {
      throttled += 1;
      continue;
    }

    planned.push({
      visitorId,
      messageId: message.id,
      title: message.title,
      devices: devices.length,
    });
    if (dryRun) continue;

    let claimed = false;
    try {
      claimed = await claim(visitorId, message.id);
    } catch (claimError) {
      console.error("[cron/send-scheduled-notifications] claim failed:", claimError.message);
      continue;
    }
    if (!claimed) continue;

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url,
      tag: message.tag,
    });

    let deliveredToAny = false;
    let lastError = "";
    for (const device of devices) {
      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth_key },
          },
          payload,
        );
        deliveredToAny = true;
        sent += 1;
      } catch (sendError) {
        failed += 1;
        const statusCode = sendError?.statusCode;
        lastError = `${statusCode || ""} ${sendError?.body || sendError?.message || ""}`.trim();
        if (statusCode === 404 || statusCode === 410) {
          // The browser discarded this subscription; stop trying forever.
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ disabled: true })
            .eq("id", device.id);
        }
      }
    }

    // Keep the claim if it reached at least one device — retrying would
    // re-notify the devices that already got it.
    if (!deliveredToAny) await releaseFailed(visitorId, message.id, lastError);
  }

  return Response.json({
    dryRun,
    istHour: istHour(),
    subscriptions: subscriptions.length,
    due: planned.length,
    throttled,
    minGapHours: MIN_GAP_HOURS,
    sent,
    failed,
    planned: planned.slice(0, 20),
    schedule: NOTIFICATION_MESSAGES.map((m) => ({ id: m.id, delayMinutes: m.delayMinutes })),
  });
}

// GET so Vercel Cron can invoke it; POST for manual curl runs.
export const GET = handle;
export const POST = handle;
