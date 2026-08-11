import { supabaseAdmin, supabaseAuth } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REMINDER_DELAY_MS = 5 * 60 * 1000;
const UNIQUE_VIOLATION = "23505";

// A pending reminder blocks any new one for that visitor, so if the sweeper
// stops running the stale row would mute that visitor permanently. Anything
// still pending well past its send time is treated as dead and stood down so
// the next wishlist add can schedule again.
const STALE_PENDING_MS = 24 * 60 * 60 * 1000;

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
      .select("id, send_at")
      .eq("visitor_id", visitorId)
      .eq("status", "pending")
      .order("send_at", { ascending: false })
      .limit(1);

    if (lookupError) throw lookupError;

    const existing = pending?.[0];
    if (existing) {
      const overdueBy = Date.now() - new Date(existing.send_at).getTime();
      if (overdueBy < STALE_PENDING_MS) {
        return Response.json({ ok: true, alreadyScheduled: true });
      }

      // Stand the dead row down so this visitor isn't muted forever.
      await supabaseAdmin
        .from("wishlist_reminders")
        .update({ status: "failed", failure_reason: "expired_unsent" })
        .eq("id", existing.id);
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
