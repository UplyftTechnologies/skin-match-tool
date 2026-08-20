import { supabaseAdmin } from "@/lib/supabase/server";
import { roopseeAdmin } from "@/lib/supabase/roopsee";
import { ensureVapid, missingVapidVars, cronAuthorized, sendToSubscription } from "@/lib/push/webpush-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_SIZE = 1000;

async function loadCatalogProductUids() {
  const uids = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await roopseeAdmin
      .from("roopsee_products")
      .select("product_uid")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    uids.push(...(data || []).map((row) => row.product_uid).filter(Boolean));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return [...new Set(uids)];
}

async function loadKnownProductUids() {
  const uids = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("known_products")
      .select("product_uid")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    uids.push(...(data || []).map((row) => row.product_uid));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return new Set(uids);
}

async function markKnown(productUids) {
  if (!productUids.length) return;
  const rows = productUids.map((product_uid) => ({ product_uid }));
  // 500-row chunks — upsert payloads this large are where Supabase's request
  // size limit actually starts to bite for a text-only table.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin
      .from("known_products")
      .upsert(rows.slice(i, i + 500), { onConflict: "product_uid", ignoreDuplicates: true });
    if (error) throw error;
  }
}

async function loadOptedInSubscriptions() {
  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("disabled", false)
    .eq("notify_new_products", true);

  if (error) throw error;
  return data || [];
}

function newProductsMessage(count) {
  return {
    title: "New products on Roopsee",
    body: count === 1
      ? "1 new product just landed in the catalog — check it out."
      : `${count} new products just landed in the catalog — check them out.`,
    url: "/AllProducts",
    tag: "new-products",
  };
}

async function handleCronRequest(request) {
  if (!cronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [catalogUids, knownUids] = await Promise.all([
      loadCatalogProductUids(),
      loadKnownProductUids(),
    ]);

    // First run ever: seed the ledger without notifying, so a fresh deploy
    // doesn't blast every subscriber about the entire existing catalog.
    if (knownUids.size === 0) {
      await markKnown(catalogUids);
      return Response.json({ ok: true, bootstrap: true, seeded: catalogUids.length });
    }

    const newUids = catalogUids.filter((uid) => !knownUids.has(uid));
    if (!newUids.length) {
      return Response.json({ ok: true, newProducts: 0, notified: 0 });
    }

    await markKnown(newUids);

    if (!ensureVapid()) {
      const missing = missingVapidVars();
      console.error("[api/cron/check-new-products] missing VAPID config:", missing.join(", "));
      return Response.json({ error: "VAPID keys are not configured", missing }, { status: 500 });
    }

    const subscriptions = await loadOptedInSubscriptions();
    if (!subscriptions.length) {
      return Response.json({ ok: true, newProducts: newUids.length, notified: 0 });
    }

    const payload = newProductsMessage(newUids.length);
    const results = await Promise.all(
      subscriptions.map((subscription) =>
        sendToSubscription(subscription, payload, "[api/cron/check-new-products]")),
    );
    const notified = results.filter((result) => result.ok).length;

    return Response.json({ ok: true, newProducts: newUids.length, notified });
  } catch (error) {
    console.error("[api/cron/check-new-products] Failed:", error.message);
    return Response.json({ error: "New product check failed" }, { status: 500 });
  }
}

export async function GET(request) {
  return handleCronRequest(request);
}

export async function POST(request) {
  return handleCronRequest(request);
}
