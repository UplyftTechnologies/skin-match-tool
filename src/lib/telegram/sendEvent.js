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

// Group where all website events are sent
const EVENT_BOT_TOKEN = process.env.TELEGRAM_EVENT_BOT_TOKEN;
const EVENT_CHAT_ID = process.env.TELEGRAM_EVENT_CHAT_ID;

// Second group where only login-related events are sent
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Events that should also be shared in the second Telegram group
const SECOND_GROUP_EVENTS = new Set([
  'login_successful',
  'existing_user_login',
  'clicked_send_otp',
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
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('event_log')
    .insert({
      user_id: userId || null,
      user_name: userName || '',
      phone_no: phone || '',
      visitor_id: visitorId || '',
      session_id: sessionId || '',
      country: country || '',
      city: city || '',
      region: region || '',
      ip_address: ip || '',
      device: device || '',
      platform: platform || '',
      browser: browser || '',
      language: language || '',
      time_ist: time || '',
      page_link: page || '',
      event_name: eventName || 'website_event',
      value: value ?? extraData?.value ?? '',
      referrer: referrer || '',
      extra_data: {
        ...extraData,
        phone: phone || extraData?.phone || '',
        visitorId: visitorId || extraData?.visitorId || '',
      },
    })
    .select()
    .maybeSingle();

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
  const hasProductDetails = productName || productId || brand || price || section;
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
📦 Section: ${getValue(section)}`
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
📞 Phone: ${getValue(phone)}
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
  const userId = body?.userId;

  if (userId) {
    try {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data: userRow, error: userError } = await supabase
          .from('users')
          .select('name')
          .eq('id', userId)
          .maybeSingle();

        if (userError) {
          console.error('Error fetching user name in buildVisitorEventFromRequest:', userError);
        }

        if (userRow?.name) {
          userName = userRow.name;
        }
      }
    } catch (error) {
      console.error('Error fetching user name in buildVisitorEventFromRequest:', error);
    }
  }

  return {
    userId: userId || null,
    userName,
    phone: body?.phone || '',
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
  };
};