import {
  getClientIp,
  getIpLocation,
  getVisitorLocationFromHeaders,
} from "../location/ipLocation.js";

const SECOND_GROUP_EVENTS = new Set([
  "login_successful",
  "existing_user_login",
  "clicked_send_otp",
]);

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readableValue(value) {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeEventName(value = "") {
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
}

async function telegramRequest({ botToken, chatId, text, groupName }) {
  if (!botToken || !chatId) {
    console.error(`[events] ${groupName} credentials are missing.`);
    return { ok: false, description: `${groupName} is not configured` };
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
  const result = await response.json().catch(() => ({
    ok: false,
    description: `Telegram responded ${response.status}`,
  }));
  if (!response.ok || result.ok === false) {
    console.error(`[events] ${groupName} delivery failed:`, result);
  }
  return result;
}

export function parseUserAgent(userAgent = "") {
  const value = String(userAgent);
  let browser = "Unknown Browser";
  let platform = "Unknown Platform";
  let device = "Desktop";

  if (/edg/i.test(value)) browser = "Microsoft Edge";
  else if (/chrome|crios/i.test(value)) browser = "Chrome";
  else if (/safari/i.test(value) && !/chrome|crios/i.test(value)) browser = "Safari";
  else if (/firefox|fxios/i.test(value)) browser = "Firefox";
  else if (/opr|opera/i.test(value)) browser = "Opera";

  if (/windows/i.test(value)) platform = "Windows";
  else if (/mac os|macintosh/i.test(value)) platform = "macOS";
  else if (/android/i.test(value)) platform = "Android";
  else if (/iphone|ipad|ios/i.test(value)) platform = "iOS";
  else if (/linux/i.test(value)) platform = "Linux";

  if (/tablet|ipad/i.test(value)) device = "Tablet";
  else if (/mobile/i.test(value)) device = "Mobile";
  return { browser, platform, device };
}

const CORE_BODY_KEYS = new Set([
  "eventName",
  "userId",
  "userName",
  "phone",
  "visitorId",
  "sessionId",
  "country",
  "city",
  "region",
  "latitude",
  "longitude",
  "ip",
  "device",
  "platform",
  "browser",
  "language",
  "timestamp",
  "time",
  "time_ist",
  "url",
  "page",
  "user_agent",
  "referrer",
  "screen_resolution",
  "timezone",
  "productName",
  "productId",
  "brand",
  "price",
  "section",
  "score",
  "question",
  "answer",
  "field",
  "value",
]);

export async function buildVisitorEventFromRequest(body, headers) {
  const ip = getClientIp(headers);
  const headerLocation = getVisitorLocationFromHeaders(headers);
  const ipLocation = headerLocation ? null : await getIpLocation(ip);
  const userAgent = parseUserAgent(headers.get("user-agent") || "");
  const extraData = Object.fromEntries(
    Object.entries(body || {}).filter(([key, value]) => (
      !CORE_BODY_KEYS.has(key)
      && value !== null
      && value !== undefined
      && value !== ""
    )),
  );

  return {
    eventName: body.eventName,
    userId: body.userId || null,
    userName: body.userName || "",
    phone: body.phone || "",
    visitorId: body.visitorId || "",
    sessionId: body.sessionId || "",
    country: body.country || headerLocation?.country || ipLocation?.country || "",
    city: body.city || headerLocation?.city || ipLocation?.city || "",
    region: body.region || headerLocation?.region || ipLocation?.region || "",
    ip: body.ip || ip,
    device: body.device || userAgent.device,
    platform: body.platform || userAgent.platform,
    browser: body.browser || userAgent.browser,
    language: body.language || headers.get("accept-language")?.split(",")?.[0] || "",
    time: body.time || body.time_ist || new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    }),
    page: body.page || body.url || "",
    referrer: body.referrer || "",
    productName: body.productName || "",
    productId: body.productId || "",
    brand: body.brand || "",
    price: body.price ?? "",
    section: body.section || "",
    score: body.score ?? "",
    question: body.question || "",
    answer: body.answer ?? "",
    field: body.field || "",
    value: body.value ?? body.answer ?? "",
    extraData,
  };
}

function detailLines(extraData) {
  return Object.entries(extraData || {}).map(([key, value]) => (
    `${escapeHtml(key)}: ${escapeHtml(readableValue(value).slice(0, 700))}`
  ));
}

export async function sendWebsiteVisitorEvent(event) {
  const location = [event.country, event.city, event.region].filter(Boolean).join(", ");
  const lines = [
    `<b>${escapeHtml(event.eventName)}</b>`,
    "",
    `👤 User: ${escapeHtml(event.userName || "Guest")}`,
    `🆔 User ID: ${escapeHtml(readableValue(event.userId))}`,
    `📞 Phone: ${escapeHtml(readableValue(event.phone))}`,
    ``,
    `🧩Visitor ID: ${escapeHtml(readableValue(event.visitorId))}`,
    `🧩Session ID: ${escapeHtml(readableValue(event.sessionId))}`,
    `📍 Location: ${escapeHtml(location || "Not available")}`,
    `🌐 IP: ${escapeHtml(readableValue(event.ip))}`,
    `📱 Device: ${escapeHtml([event.device, event.platform, event.browser].filter(Boolean).join(", "))}`,
    ``,
    `🌎 Language: ${escapeHtml(readableValue(event.language))}`,
    `⏰Time: ${escapeHtml(readableValue(event.time))}`,
    `🔗 Page: ${escapeHtml(readableValue(event.page))}`,
    `💬 Referrer: ${escapeHtml(readableValue(event.referrer))}`,
  ];

  if (event.productName || event.productId || event.brand || event.price || event.section || event.score !== "") {
    lines.push(
      "",
      `Product: ${escapeHtml(readableValue(event.productName))}`,
      `Brand: ${escapeHtml(readableValue(event.brand))}`,
      `Product ID: ${escapeHtml(readableValue(event.productId))}`,
      `Price: ${escapeHtml(readableValue(event.price))}`,
      `Section: ${escapeHtml(readableValue(event.section))}`,
      `Match score: ${escapeHtml(readableValue(event.score))}`,
    );
  }
  if (event.question || event.answer || event.field) {
    lines.push(
      "",
      `Question: ${escapeHtml(readableValue(event.question || event.field))}`,
      `Answer: ${escapeHtml(readableValue(event.answer || event.value))}`,
      `Field: ${escapeHtml(readableValue(event.field))}`,
    );
  }

  const extras = detailLines(event.extraData);
  if (extras.length) lines.push("", "Event data:", ...extras);
  const text = lines.join("\n").slice(0, 4000);

  const requests = [
    telegramRequest({
      botToken: process.env.TELEGRAM_EVENT_BOT_TOKEN,
      chatId: process.env.TELEGRAM_EVENT_CHAT_ID,
      text,
      groupName: "Telegram event group",
    }),
  ];

  if (
    SECOND_GROUP_EVENTS.has(normalizeEventName(event.eventName))
    && process.env.TELEGRAM_EVENT_BOT_TOKEN
    && process.env.TELEGRAM_EVENT_CHAT_ID
  ) {
    requests.push(telegramRequest({
      botToken: process.env.TELEGRAM_EVENT_BOT_TOKEN,
      chatId: process.env.TELEGRAM_EVENT_CHAT_ID,
      text,
      groupName: "Telegram login group",
    }));
  }

  return Promise.allSettled(requests);
}
