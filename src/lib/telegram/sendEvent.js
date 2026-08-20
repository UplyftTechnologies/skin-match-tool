// lib/telegram/sendEvent.js
// Ported from your Express service.js. Two changes from the original:
//   1. Uses `fetch` instead of Node's `https` module — Next.js route
//      handlers run fine with fetch, no need for the manual req/Buffer setup.
//   2. Takes plain objects instead of an Express `req` — App Router request
//      bodies must be read with `await req.json()` before you can pass
//      pieces of it around, so the "build event from request" step now takes
//      the already-parsed body + headers instead of the raw req.
import {
  getClientIp,
  getVisitorLocationFromHeaders,
  getIpLocation,
} from '../location/ipLocation.js';
import { supabaseAdmin } from '../supabase/server.js';

// Group where all website events are sent
const EVENT_BOT_TOKEN = process.env.TELEGRAM_EVENT_BOT_TOKEN;
const EVENT_CHAT_ID = process.env.TELEGRAM_EVENT_CHAT_ID;

// Second group where only login-related events are sent
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Third group — quiz/OTP/login reports
const REPORTS_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_REPORTS;
const REPORTS_CHAT_ID = process.env.TELEGRAM_CHAT_ID_REPORTS;

// Events that should also be shared in the second Telegram group
const SECOND_GROUP_EVENTS = new Set([
  'login_successful',
  'existing_user_login',
  'clicked_send_otp',
  'clicked_resend_otp',
]);

const REPORTS_GROUP_EVENTS = new Set([
  'quiz_completed',
  'quiz_updated',
  'clicked_send_otp',
  'clicked_resend_otp',
  'otp_verified',
  'login_successful',
  'existing_user_login',
]);

// ─── Save event in Supabase ────────────────────────────────────────────────

export const saveEventLog = async ({
  userId,
  userName,
  phone,
  visitorId,
  sessionId,
  country,
  city,
  region,
  ip,
  device,
  platform,
  browser,
  language,
  time,
  page,
  eventName,
  value,
  referrer,
  extraData = {},
}) => {
  const textValue = (input) => {
    if (input === null || input === undefined) return null;
    if (typeof input === 'string') return input.slice(0, 2000);
    if (typeof input === 'number' || typeof input === 'boolean') return String(input);
    return JSON.stringify(input).slice(0, 2000);
  };

  const { data, error } = await supabaseAdmin
    .from('event_log')
    .insert({
      user_id: userId || null,
      user_name: userName || null,
      phone_no: phone || null,
      visitor_id: visitorId || null,
      session_id: sessionId || null,
      country: country || null,
      city: city || null,
      region: region || null,
      ip_address: ip || null,
      device: device || null,
      platform: platform || null,
      browser: browser || null,
      language: language || null,
      time_ist: time || null,
      page_link: page || null,
      event_name: eventName || 'website_event',
      value: textValue(value ?? extraData?.value),
      referrer: referrer || null,
      extra_data: {
        ...extraData,
      },
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('Event log insert error:', error);
    return null;
  }

  return data;
};

// ─── Generic Telegram request helper ───────────────────────────────────────

const telegramRequest = async ({
  botToken,
  chatId,
  path = 'sendMessage',
  payload,
  groupName = 'Telegram',
}) => {
  if (!botToken || !chatId) {
    console.error(`${groupName} env missing. Notification skipped.`);
    return null;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        chat_id: chatId,
        ...payload,
        parse_mode: 'HTML',
      }),
    });

    const parsed = await response.json().catch(async () => response.text());

    if (parsed?.ok === false) {
      console.error(`${groupName} notification failed:`, parsed);
    }

    return parsed;
  } catch (error) {
    console.error(`${groupName} request error:`, error);
    throw error;
  }
};

// Send notification to the main event group
const telegramEventRequest = (path, payload) =>
  telegramRequest({
    botToken: EVENT_BOT_TOKEN,
    chatId: EVENT_CHAT_ID,
    path,
    payload,
    groupName: 'Telegram event group',
  });

// Send notification to the second group
const telegramSecondGroupRequest = (path, payload) =>
  telegramRequest({
    botToken: TELEGRAM_BOT_TOKEN,
    chatId: TELEGRAM_CHAT_ID,
    path,
    payload,
    groupName: 'Telegram login group',
  });

const telegramReportsRequest = (path, payload) =>
  telegramRequest({
    botToken: REPORTS_BOT_TOKEN,
    chatId: REPORTS_CHAT_ID,
    path,
    payload,
    groupName: 'Telegram reports group',
  });

// ─── Helpers ────────────────────────────────────────────────────────────────

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getValue = (value, fallback = 'Not available') => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return escapeHtml(value);
};

const normalizeEventName = (eventName = '') =>
  String(eventName).trim().toLowerCase().replace(/[\s-]+/g, '_');

const EXTRA_DATA_IGNORED_FIELDS = new Set([
  'eventName',
  'userId',
  'userName',
  'phone',
  'phone_number',
  'visitorId',
  'sessionId',
  'country',
  'city',
  'region',
  'ip',
  'device',
  'platform',
  'browser',
  'language',
  'time',
  'time_ist',
  'page',
  'url',
  'referrer',
  'value',
  'timestamp',
  'retailer',
  'site',
]);

const buildExtraData = (body = {}) => {
  const extraData = {};

  Object.entries(body).slice(0, 60).forEach(([key, value]) => {
    if (EXTRA_DATA_IGNORED_FIELDS.has(key) || value === undefined) return;
    if (typeof value === 'string') {
      extraData[key] = value.slice(0, 2000);
      return;
    }

    if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      extraData[key] = value;
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      extraData[key] = serialized.length <= 5000
        ? value
        : `${serialized.slice(0, 5000)}…`;
    } catch {
      extraData[key] = String(value).slice(0, 2000);
    }
  });

  return extraData;
};

export const parseUserAgent = (userAgent = '') => {
  const ua = String(userAgent);

  let browser = 'Unknown Browser';
  let platform = 'Unknown Platform';
  let device = 'Desktop';

  if (/edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';

  if (/windows/i.test(ua)) platform = 'Windows';
  else if (/mac os|macintosh/i.test(ua)) platform = 'macOS';
  else if (/android/i.test(ua)) platform = 'Android';
  else if (/iphone|ipad|ios/i.test(ua)) platform = 'iOS';
  else if (/linux/i.test(ua)) platform = 'Linux';

  if (/mobile/i.test(ua)) device = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

  return { browser, platform, device };
};

// ─── Main Telegram notification ────────────────────────────────────────────

export const sendWebsiteVisitorEvent = async ({
  userId,
  userName,
  sessionId,
  phone,
  country,
  city,
  region,
  ip,
  device,
  platform,
  browser,
  language,
  time,
  page,
  referrer,
  eventName,
  productName,
  productId,
  brand,
  price,
  section,
  retailer,
  site,
  cartItems,
  cartTotal,
  question,
  answer,
  value,
  field,
  answerType,
  step,
  quizAnswerSummary,
}) => {
  const retailerName = retailer || site;
  const hasProductDetails = productName || productId || brand || price || section || retailerName;
  const hasCartDetails = cartItems !== null && cartItems !== undefined && cartItems !== '';
  const hasAnswerDetails = quizAnswerSummary || question || answer || field || answerType || step;

  const cleanListValue = (itemValue) => {
    const result = getValue(itemValue);
    return result && result !== 'Not available' ? result : '';
  };

  const answerBlock = hasAnswerDetails
    ? `

🧾 Quiz Answer: ${quizAnswerSummary ? getValue(quizAnswerSummary) : `${getValue(question)}: ${getValue(answer)}`}
📝 Question: ${getValue(question)}
✅ Answer: ${getValue(answer)}
🔢 Step: ${getValue(step)}
🏷 Answer Type: ${getValue(answerType)}
📌 Field: ${getValue(field)}`
    : '';

  const productBlock = hasProductDetails
    ? `

🛒 Product: ${getValue(productName)}
🏷 Brand: ${getValue(brand)}
🆔 Product ID: ${getValue(productId)}
💰 Price: ${getValue(price)}
📦 Section: ${getValue(section)}
🏬 Retailer: ${getValue(retailerName)}`
    : '';

  const cartBlock = hasCartDetails
    ? `

🛒 Cart Items: ${getValue(cartItems)}
💰 Cart Total: ${getValue(cartTotal)}`
    : '';

  const isExistingUser = userName && userName !== 'Guest';

  const text = `${isExistingUser ? '💌' : '🟢'} <b>${getValue(eventName)}</b>

👤 ${getValue(userName || 'Guest')}
🆔 User ID: ${getValue(userId)}
📞 Phone: +91${getValue(phone)}
🧩 Session ID: ${getValue(sessionId)}
📍 ${[cleanListValue(country), cleanListValue(city), cleanListValue(region)].filter(Boolean).join(', ')}
🌐 IP: ${getValue(ip)}
📱 ${[cleanListValue(device), cleanListValue(platform), cleanListValue(browser)].filter(Boolean).join(', ')}
🌎 Language: ${getValue(language)}
⏰ ${getValue(time)}


📄 Page: ${getValue(page)}
🔗 Referrer: ${getValue(referrer)}
💬 Value: ${getValue(value)}${answerBlock}${productBlock}${cartBlock}`;

  const normalizedEventName = normalizeEventName(eventName);

  const requests = [
    // Every event goes to the main event group
    telegramEventRequest('sendMessage', { text }),
  ];
  if (REPORTS_GROUP_EVENTS.has(normalizedEventName)) {
    requests.push(telegramReportsRequest('sendMessage', { text }));
  }

  // Only these events also go to the second Telegram group
  if (SECOND_GROUP_EVENTS.has(normalizedEventName)) {
    requests.push(telegramSecondGroupRequest('sendMessage', { text }));
  }

  const results = await Promise.allSettled(requests);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        index === 0
          ? 'Main event Telegram notification rejected:'
          : 'Second Telegram notification rejected:',
        result.reason
      );
    }
  });

  return results;
};

// ─── Build event data from a parsed Next.js request ────────────────────────
// Call this with `await req.json()` and `req.headers` from your route handler
// (see app/api/events/route.js) — NOT the raw Request object, since App
// Router bodies can only be read once and async.

export const buildVisitorEventFromRequest = async (body, headers) => {
  const ip = getClientIp(headers);
  const locationFromHeaders = getVisitorLocationFromHeaders(headers);
  const locationFromIp = locationFromHeaders ? null : await getIpLocation(ip);
  const userAgentInfo = parseUserAgent(headers.get('user-agent') || '');

  let userName = body?.userName || '';
  // OTP/login events send the typed number as `phone_number`, not `phone`
  // (see use-otp-auth.js) — without this fallback it never reaches Telegram.
  let phone = body?.phone || body?.phone_number || '';
  let userId = null;
  const requestedUserId = body?.userId;

  if (requestedUserId) {
    try {
      const { data: userRow, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', requestedUserId)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching event user in buildVisitorEventFromRequest:', userError);
      } else if (userRow) {
        userId = userRow.id;
        userName = userRow.name || userName;
        phone = userRow.phone_no || phone;
      }
    } catch (error) {
      console.error('Error fetching event user in buildVisitorEventFromRequest:', error);
    }
  }

  return {
    userId: userId || null,
    userName,
    phone,
    sessionId: body?.sessionId || '',
    visitorId: body?.visitorId || '',

    country: body?.country || locationFromHeaders?.country || locationFromIp?.country || '',
    city: body?.city || locationFromHeaders?.city || locationFromIp?.city || '',
    region: body?.region || locationFromHeaders?.region || locationFromIp?.region || '',

    ip: body?.ip || ip,

    device: body?.device || userAgentInfo.device,
    platform: body?.platform || userAgentInfo.platform,
    browser: body?.browser || userAgentInfo.browser,

    language: body?.language || headers.get('accept-language')?.split(',')?.[0] || '',

    time:
      body?.time ||
      new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
      }),

    page: body?.page || '',
    referrer: body?.referrer || '',
    eventName: body?.eventName || 'website_visitor',

    value: body?.value ?? body?.answer ?? '',

    productName: body?.productName || '',
    productId: body?.productId || '',
    brand: body?.brand || '',
    price: body?.price ?? '',
    section: body?.section || '',
    retailer: body?.retailer || '',
    site: body?.site || '',

    cartItems: body?.cartItems || '',
    cartTotal: body?.cartTotal ?? '',

    question: body?.question || '',
    answer: body?.answer || '',
    field: body?.field || '',
    answerType: body?.answerType || body?.field || '',
    step: body?.step || body?.field || '',

    quizAnswerSummary:
      body?.quizAnswerSummary ||
      (body?.question && body?.answer ? `${body.question}: ${body.answer}` : ''),

    extraData: buildExtraData(body),
  };
};
