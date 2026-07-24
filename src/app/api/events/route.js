import {
  buildVisitorEventFromRequest,
  sendWebsiteVisitorEvent,
} from "@/lib/telegram/sendEvent";

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
    const results = await sendWebsiteVisitorEvent(eventData);
    const mainResult = results[0];
    const telegramSent = mainResult?.status === "fulfilled" && Boolean(mainResult.value?.ok);

    return Response.json(
      { ok: telegramSent, telegramSent },
      { status: telegramSent ? 200 : 502 },
    );
  } catch (error) {
    console.error("[api/events] Event delivery failed:", error);
    return Response.json(
      { error: "Event delivery failed", telegramSent: false },
      { status: 502 },
    );
  }
}
