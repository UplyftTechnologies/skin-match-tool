import {
  buildVisitorEventFromRequest,
  saveEventLog,
  sendWebsiteVisitorEvent,
} from "@/lib/telegram/sendEvent";
import { supabaseAdmin, supabaseAuth } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.eventName || typeof body.eventName !== "string") {
    return Response.json({ error: "eventName is required" }, { status: 400 });
  }

  try {
    const eventData = await buildVisitorEventFromRequest(body, request.headers);
    const [databaseResult, telegramResult] = await Promise.allSettled([
      saveEventLog(eventData),
      sendWebsiteVisitorEvent(eventData),
    ]);

    const eventSaved = databaseResult.status === "fulfilled" && Boolean(databaseResult.value?.id);
    const telegramResults = telegramResult.status === "fulfilled" ? telegramResult.value : [];
    const mainResult = telegramResults[0];
    const telegramSent = mainResult?.status === "fulfilled" && Boolean(mainResult.value?.ok);

    return Response.json(
      { ok: eventSaved, eventSaved, telegramSent },
      { status: eventSaved ? 200 : 502 },
    );
  } catch (error) {
    console.error("[api/events] Event delivery failed:", error);
    return Response.json(
      { error: "Event delivery failed", telegramSent: false },
      { status: 502 },
    );
  }
}

function cleanIdentity(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  return /^[a-zA-Z0-9_-]{8,128}$/.test(cleaned) ? cleaned : "";
}

async function authenticatedUser(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
  return error ? null : data.user;
}

export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = await authenticatedUser(request);
  if (!user) {
    return Response.json({ error: "Authentication is required" }, { status: 401 });
  }

  const sessionId = cleanIdentity(body?.sessionId);
  const visitorId = cleanIdentity(body?.visitorId);
  if (!sessionId || !visitorId) {
    return Response.json(
      { error: "Valid sessionId and visitorId values are required" },
      { status: 400 },
    );
  }

  const metadata = user.user_metadata || {};

  try {
    const { data: publicUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) throw userError;

    const phoneNumber = publicUser?.phone_no
      || user.phone
      || metadata.phone_no
      || metadata.phone
      || null;
    const userName = publicUser?.name
      || metadata.full_name
      || metadata.name
      || null;

    const { data, error } = await supabaseAdmin
      .from("event_log")
      .update({
        user_id: user.id,
        user_name: userName,
        phone_no: phoneNumber,
      })
      .eq("session_id", sessionId)
      .eq("visitor_id", visitorId)
      .is("user_id", null)
      .select("id");

    if (error) throw error;

    return Response.json({
      ok: true,
      updated: data?.length || 0,
    });
  } catch (error) {
    console.error("[api/events] Event identity claim failed:", error);
    return Response.json(
      {
        error: "Unable to attach the user to event records",
        code: error?.code || "EVENT_IDENTITY_CLAIM_FAILED",
      },
      { status: 500 },
    );
  }
}
