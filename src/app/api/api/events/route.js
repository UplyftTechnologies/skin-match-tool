// app/api/events/route.js
// POST /api/events
// Called by lib/tracking/trackingClient.js on every trackEvent() call.
// Runs saveEventLog (Supabase) and sendWebsiteVisitorEvent (Telegram) in
// parallel, same as your original Express handler did.
import { NextResponse } from 'next/server';
import { saveEventLog, sendWebsiteVisitorEvent, buildVisitorEventFromRequest } from '../../../lib/telegram/sendEvent.js';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventData = await buildVisitorEventFromRequest(body, req.headers);

  const [logResult, telegramResult] = await Promise.allSettled([
    saveEventLog(eventData),
    sendWebsiteVisitorEvent(eventData),
  ]);

  if (logResult.status === 'rejected') {
    console.error('[api/events] Supabase log failed:', logResult.reason);
  }
  if (telegramResult.status === 'rejected') {
    console.error('[api/events] Telegram alert failed:', telegramResult.reason);
  }

  // Never fail the request just because a downstream sink failed — the
  // event was still received, and the client shouldn't retry/spam over it.
  return NextResponse.json({
    ok: true,
    logged: logResult.status === 'fulfilled' && !!logResult.value,
    telegramSent: telegramResult.status === 'fulfilled',
  });
}