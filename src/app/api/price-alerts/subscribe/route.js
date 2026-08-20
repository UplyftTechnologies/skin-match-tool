import { supabaseAdmin, supabaseAuth } from "@/lib/supabase/server";

export const runtime = "nodejs";

function cleanIdentity(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(cleaned) ? cleaned : "";
}

function cleanProductUid(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  return cleaned && cleaned.length <= 128 ? cleaned : "";
}

async function authenticatedUserId(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
  return error ? null : data.user?.id || null;
}

// Used to paint the button's initial state (subscribed vs not) on load.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const visitorId = cleanIdentity(searchParams.get("visitorId") || "");
  const productUid = cleanProductUid(searchParams.get("productUid") || "");

  if (!visitorId || !productUid) {
    return Response.json({ subscribed: false });
  }

  const { data, error } = await supabaseAdmin
    .from("price_drop_alerts")
    .select("id")
    .eq("visitor_id", visitorId)
    .eq("product_uid", productUid)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[api/price-alerts/subscribe] status lookup failed:", error.message);
    return Response.json({ subscribed: false });
  }

  return Response.json({ subscribed: Boolean(data) });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const visitorId = cleanIdentity(body?.visitorId);
  const productUid = cleanProductUid(body?.productUid);
  const watchPrice = Number(body?.watchPrice);

  if (!visitorId || !productUid || !Number.isFinite(watchPrice) || watchPrice <= 0) {
    return Response.json(
      { error: "visitorId, productUid and a valid watchPrice are required" },
      { status: 400 },
    );
  }

  const userId = await authenticatedUserId(request);
  const productName = typeof body?.productName === "string" ? body.productName.slice(0, 300) : null;

  try {
    const { error } = await supabaseAdmin
      .from("price_drop_alerts")
      .upsert(
        {
          visitor_id: visitorId,
          user_id: userId,
          product_uid: productUid,
          product_name: productName,
          watch_price: watchPrice,
          // Re-subscribing resets the baseline, so a drop from the new
          // watch_price fires fresh instead of reusing a stale threshold.
          last_notified_price: null,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "visitor_id,product_uid" },
      );

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/price-alerts/subscribe] Failed to save alert:", error.message);
    return Response.json({ error: "Unable to save price alert" }, { status: 500 });
  }
}

export async function DELETE(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const visitorId = cleanIdentity(body?.visitorId);
  const productUid = cleanProductUid(body?.productUid);

  if (!visitorId || !productUid) {
    return Response.json({ error: "visitorId and productUid are required" }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("price_drop_alerts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("visitor_id", visitorId)
      .eq("product_uid", productUid);

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/price-alerts/subscribe] Failed to cancel alert:", error.message);
    return Response.json({ error: "Unable to cancel price alert" }, { status: 500 });
  }
}
