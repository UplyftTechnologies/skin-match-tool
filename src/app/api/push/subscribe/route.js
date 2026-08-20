import { supabaseAdmin, supabaseAuth } from "@/lib/supabase/server";

export const runtime = "nodejs";

function cleanIdentity(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(cleaned) ? cleaned : "";
}

async function authenticatedUserId(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
  return error ? null : data.user?.id || null;
}

// Used to paint the "notify me about new products" toggle's initial state.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const visitorId = cleanIdentity(searchParams.get("visitorId") || "");
  if (!visitorId) {
    return Response.json({ notifyNewProducts: false });
  }

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id")
    .eq("visitor_id", visitorId)
    .eq("disabled", false)
    .eq("notify_new_products", true)
    .limit(1);

  if (error) {
    console.error("[api/push/subscribe] notify_new_products lookup failed:", error.message);
    return Response.json({ notifyNewProducts: false });
  }

  return Response.json({ notifyNewProducts: Boolean(data?.length) });
}

// Flips the new-product opt-in for every active subscription this visitor
// has (there's usually just one, but a visitor can have several devices).
export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const visitorId = cleanIdentity(body?.visitorId);
  const notifyNewProducts = Boolean(body?.notifyNewProducts);

  if (!visitorId) {
    return Response.json({ error: "visitorId is required" }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .update({ notify_new_products: notifyNewProducts, updated_at: new Date().toISOString() })
      .eq("visitor_id", visitorId)
      .eq("disabled", false);

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/push/subscribe] Failed to update notify_new_products:", error.message);
    return Response.json({ error: "Unable to update notification preference" }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const visitorId = cleanIdentity(body?.visitorId);
  const endpoint = typeof body?.subscription?.endpoint === "string" ? body.subscription.endpoint : "";
  const p256dh = body?.subscription?.keys?.p256dh;
  const authKey = body?.subscription?.keys?.auth;

  if (!visitorId || !endpoint || !p256dh || !authKey) {
    return Response.json({ error: "visitorId and a valid push subscription are required" }, { status: 400 });
  }

  const userId = await authenticatedUserId(request);
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 500);

  try {
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          visitor_id: visitorId,
          user_id: userId,
          endpoint,
          p256dh,
          auth_key: authKey,
          user_agent: userAgent,
          disabled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/push/subscribe] Failed to save push subscription:", error.message);
    return Response.json({ error: "Unable to save push subscription" }, { status: 500 });
  }
}
