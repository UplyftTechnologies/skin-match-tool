import { supabaseAdmin } from "@/lib/supabase/server";
import { roopseeAdmin } from "@/lib/supabase/roopsee";
import { ensureVapid, missingVapidVars, cronAuthorized, sendToSubscription } from "@/lib/push/webpush-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Alerts checked per run. A backlog beyond this just rolls into the next
// scheduled run rather than risking a serverless timeout.
const BATCH_LIMIT = 200;

async function loadActiveAlerts() {
  const { data, error } = await supabaseAdmin
    .from("price_drop_alerts")
    .select("id, visitor_id, product_uid, product_name, watch_price, last_notified_price")
    .eq("status", "active")
    .order("updated_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) throw error;
  return data || [];
}

async function loadCurrentPrices(productUids) {
  if (!productUids.length) return new Map();

  const { data, error } = await roopseeAdmin
    .from("roopsee_products")
    .select("product_uid, selling_price")
    .in("product_uid", productUids);

  if (error) throw error;

  const byProduct = new Map();
  for (const row of data || []) {
    const price = Number(row.selling_price);
    if (Number.isFinite(price) && price > 0) byProduct.set(row.product_uid, price);
  }
  return byProduct;
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

function priceDropMessage(alert, currentPrice) {
  const name = alert.product_name || "A product you're watching";
  return {
    title: "Price drop alert",
    body: `${name} is now ₹${Math.ceil(currentPrice)} (was ₹${Math.ceil(alert.watch_price)}).`,
    url: `/products/${alert.product_uid}`,
    tag: `price-drop-${alert.product_uid}`,
  };
}

async function handleCronRequest(request) {
  if (!cronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ensureVapid()) {
    const missing = missingVapidVars();
    console.error("[api/cron/check-price-drops] missing VAPID config:", missing.join(", "));
    return Response.json({ error: "VAPID keys are not configured", missing }, { status: 500 });
  }

  try {
    const alerts = await loadActiveAlerts();
    if (!alerts.length) {
      return Response.json({ ok: true, checked: 0, dropped: 0, notified: 0 });
    }

    const productUids = [...new Set(alerts.map((alert) => alert.product_uid))];
    const pricesByProduct = await loadCurrentPrices(productUids);

    // Notify below the last-notified price (or the original watch price, if
    // never notified) so a repeat drop fires again instead of going quiet
    // after the first push.
    const dropped = alerts.filter((alert) => {
      const currentPrice = pricesByProduct.get(alert.product_uid);
      if (!currentPrice) return false;
      const threshold = alert.last_notified_price ?? alert.watch_price;
      return currentPrice < threshold;
    });

    if (!dropped.length) {
      return Response.json({ ok: true, checked: alerts.length, dropped: 0, notified: 0 });
    }

    const visitorIds = [...new Set(dropped.map((alert) => alert.visitor_id))];
    const subscriptionsByVisitor = await loadSubscriptions(visitorIds);

    let notified = 0;

    for (const alert of dropped) {
      const currentPrice = pricesByProduct.get(alert.product_uid);
      const subscriptions = subscriptionsByVisitor.get(alert.visitor_id) || [];
      if (!subscriptions.length) continue;

      const payload = priceDropMessage(alert, currentPrice);
      const results = await Promise.all(
        subscriptions.map((subscription) =>
          sendToSubscription(subscription, payload, "[api/cron/check-price-drops]")),
      );
      const delivered = results.some((result) => result.ok);

      if (delivered) {
        notified += 1;
        await supabaseAdmin
          .from("price_drop_alerts")
          .update({ last_notified_price: currentPrice, updated_at: new Date().toISOString() })
          .eq("id", alert.id);
      }
    }

    return Response.json({ ok: true, checked: alerts.length, dropped: dropped.length, notified });
  } catch (error) {
    console.error("[api/cron/check-price-drops] Failed:", error.message);
    return Response.json({ error: "Price drop check failed" }, { status: 500 });
  }
}

export async function GET(request) {
  return handleCronRequest(request);
}

export async function POST(request) {
  return handleCronRequest(request);
}
