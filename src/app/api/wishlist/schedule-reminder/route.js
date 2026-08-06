import { supabaseAdmin, supabaseAuth } from "@/lib/supabase/server";

export const runtime = "nodejs";

// TESTING: 1 minute instead of 15 — revert before shipping.
const REMINDER_DELAY_MS = 1 * 60 * 1000;
const UNIQUE_VIOLATION = "23505";

function cleanIdentity(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(cleaned) ? cleaned : "";
}

function cleanText(value, maxLength = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

async function authenticatedUserId(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
  return error ? null : data.user?.id || null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const visitorId = cleanIdentity(body?.visitorId);
  const productUid = cleanText(body?.productUid, 120);
  if (!visitorId || !productUid) {
    return Response.json({ error: "visitorId and productUid are required" }, { status: 400 });
  }

  const sessionId = cleanIdentity(body?.sessionId) || null;
  const productName = cleanText(body?.productName, 200) || null;
  const userId = await authenticatedUserId(request);

  try {
    const { data: pending, error: lookupError } = await supabaseAdmin
      .from("wishlist_reminders")
      .select("id")
      .eq("visitor_id", visitorId)
      .eq("status", "pending")
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (pending) {
      return Response.json({ ok: true, alreadyScheduled: true });
    }

    const sendAt = new Date(Date.now() + REMINDER_DELAY_MS).toISOString();
    const { error: insertError } = await supabaseAdmin.from("wishlist_reminders").insert({
      visitor_id: visitorId,
      session_id: sessionId,
      user_id: userId,
      product_uid: productUid,
      product_name: productName,
      send_at: sendAt,
      status: "pending",
    });

    if (insertError && insertError.code !== UNIQUE_VIOLATION) throw insertError;

    return Response.json({ ok: true, sendAt });
  } catch (error) {
    console.error("[api/wishlist/schedule-reminder] Failed to schedule reminder:", error.message);
    return Response.json({ error: "Unable to schedule reminder" }, { status: 500 });
  }
}
