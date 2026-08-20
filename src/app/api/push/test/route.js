// Fires one of the rotating notifications on demand, for testing the real
// end-to-end push path (server -> push service -> service worker) rather than
// waiting on the wishlist cron.
//
// Deliberately NOT open in production: without a guard this is an endpoint that
// lets anyone push a notification to every subscriber.
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";
import { NOTIFICATION_MESSAGES, messageById, randomMessage } from "@/lib/push/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function vapidPublicKey() {
  // The browser subscribes with NEXT_PUBLIC_VAPID_PUBLIC_KEY, and the push
  // service binds each subscription to that exact key — signing with a
  // different one returns 403 VapidPkHashMismatch. Same rule as the cron.
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

// This endpoint pushes to every subscriber, so on production it always needs
// CRON_SECRET — deliberately no env-var escape hatch, and specifically not a
// NEXT_PUBLIC_* one, since those are readable by anyone who loads the site.
function allowed(request) {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[api/push/test] CRON_SECRET is not set — refusing every request");
    return false;
  }
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const query = new URL(request.url).searchParams.get("token") || "";
  return bearer === secret || query === secret;
}

// Status check: the pool, whether anyone is subscribed, and whether VAPID is
// configured — the three things worth knowing before wondering why nothing
// arrived. Same guard as POST, since the subscriber count is not public.
export async function GET(request) {
  if (!allowed(request)) {
    return Response.json({ error: "Not available." }, { status: 403 });
  }

  const { count, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("disabled", false);

  // The browser subscribes with NEXT_PUBLIC_VAPID_PUBLIC_KEY and the push
  // service pins each subscription to it. If the server signs with a different
  // key every send fails 403 VapidPkHashMismatch — and because the two vars are
  // set separately in the dashboard, updating one and not the other is easy to
  // do and invisible until nothing arrives. Report it rather than let it hide.
  const clientKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const serverKey = (process.env.VAPID_PUBLIC_KEY || "").trim();

  return Response.json({
    messages: NOTIFICATION_MESSAGES.map(({ id, title }) => ({ id, title })),
    activeSubscriptions: error ? null : count,
    vapidConfigured: Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY),
    vapid: {
      publicKeySet: Boolean(clientKey),
      serverKeySet: Boolean(serverKey),
      privateKeySet: Boolean((process.env.VAPID_PRIVATE_KEY || "").trim()),
      keysMatch: Boolean(clientKey && serverKey) ? clientKey === serverKey : null,
      // Enough to compare against your dashboard without exposing the key.
      publicKeyFingerprint: clientKey ? `${clientKey.slice(0, 8)}…${clientKey.slice(-6)}` : null,
      subject: process.env.VAPID_SUBJECT || null,
    },
  });
}

export async function POST(request) {
  if (!allowed(request)) {
    return Response.json({ error: "Not available." }, { status: 403 });
  }
  if (!configureVapid()) {
    return Response.json(
      { error: "VAPID keys are not configured — set VAPID_PRIVATE_KEY and the public key." },
      { status: 503 },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is fine: send a random message to everyone.
  }

  const message = body?.messageId ? messageById(body.messageId) : randomMessage();
  if (!message) {
    return Response.json({ error: "Unknown messageId." }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("push_subscriptions")
    .select("id, visitor_id, endpoint, p256dh, auth_key")
    .eq("disabled", false);
  if (body?.visitorId) query = query.eq("visitor_id", body.visitorId);

  const { data: subscriptions, error } = await query;
  if (error) {
    console.error("[api/push/test] Failed to load subscriptions:", error.message);
    return Response.json({ error: "Unable to load subscriptions." }, { status: 500 });
  }
  if (!subscriptions?.length) {
    return Response.json({
      sent: 0,
      message,
      hint: "No active push subscriptions. Grant notification permission in the browser first.",
    });
  }

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url,
    tag: message.tag,
  });

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          },
          payload,
        );
        return { ok: true };
      } catch (sendError) {
        const statusCode = sendError?.statusCode;
        // 404/410 mean the browser threw the subscription away; anything else
        // (403 key mismatch, 401 bad JWT) is a config problem worth surfacing.
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ disabled: true })
            .eq("id", subscription.id);
        }
        console.error("[api/push/test] send failed", {
          statusCode,
          body: sendError?.body,
          endpoint: String(subscription.endpoint || "").slice(0, 60),
        });
        return { ok: false, statusCode, detail: sendError?.body || sendError?.message };
      }
    }),
  );

  const failures = results.filter((result) => !result.ok);
  return Response.json({
    message,
    attempted: results.length,
    sent: results.length - failures.length,
    failed: failures.length,
    failures: failures.slice(0, 5),
  });
}
