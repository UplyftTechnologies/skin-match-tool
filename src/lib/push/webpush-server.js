import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";

// Shared by every push-sending cron route (wishlist reminders, price drop
// alerts, new product alerts) so the VAPID setup and delivery/expiry
// bookkeeping live in exactly one place.

let vapidReady = false;

function vapidPublicKey() {
  // The BROWSER subscribes with NEXT_PUBLIC_VAPID_PUBLIC_KEY (see
  // src/lib/push/subscribe.js). The push service binds every subscription to
  // that exact key and rejects anything signed with a different one as
  // 403 VapidPkHashMismatch — so the client's value MUST win here.
  // VAPID_PUBLIC_KEY is only a fallback for when the public var was absent from
  // the build. Both are trimmed: a trailing newline from a dashboard paste is
  // enough to break the match.
  const clientKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const serverKey = (process.env.VAPID_PUBLIC_KEY || "").trim();

  if (clientKey && serverKey && clientKey !== serverKey) {
    console.error(
      "[push] VAPID_PUBLIC_KEY differs from NEXT_PUBLIC_VAPID_PUBLIC_KEY. Signing with " +
        "the public one, because that is what existing subscriptions were created against. " +
        "Make them identical.",
    );
  }

  return clientKey || serverKey;
}

export function missingVapidVars() {
  const missing = [];
  if (!vapidPublicKey()) missing.push("VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY)");
  if (!process.env.VAPID_PRIVATE_KEY) missing.push("VAPID_PRIVATE_KEY");
  return missing;
}

export function ensureVapid() {
  if (vapidReady) return true;
  if (missingVapidVars().length) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@roopsee.com",
    vapidPublicKey(),
    process.env.VAPID_PRIVATE_KEY.trim(),
  );
  vapidReady = true;
  return true;
}

/**
 * Vercel Cron calls the production deployment on schedule and attaches
 * `Authorization: Bearer $CRON_SECRET` automatically — but only when
 * CRON_SECRET is set on the project, otherwise it sends no auth header at
 * all and every run 401s here.
 */
export function cronAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[push] CRON_SECRET is not set — every cron run will 401");
    return false;
  }

  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const queryToken = new URL(request.url).searchParams.get("secret") || "";

  return bearerToken === secret || queryToken === secret;
}

export async function sendToSubscription(subscription, payload, logPrefix = "[push]") {
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
    const statusCode = error?.statusCode;
    const expired = statusCode === 404 || statusCode === 410;

    // The push service's own status and body are the ONLY things that separate
    // a VAPID key mismatch (403) from an expired endpoint (410) from a bad JWT
    // (401). Swallowing them left every failure looking identical.
    console.error(`${logPrefix} push send failed`, {
      statusCode,
      body: error?.body,
      message: error?.message,
      endpoint: String(subscription.endpoint || "").slice(0, 60),
    });

    if (expired) {
      await supabaseAdmin.from("push_subscriptions").update({ disabled: true }).eq("id", subscription.id);
    }
    return { ok: false, expired, statusCode };
  }
}
