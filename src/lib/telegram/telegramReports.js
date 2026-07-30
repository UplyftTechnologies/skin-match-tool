// lib/telegramReports.js
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_REPORTS;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID_REPORTS;

async function sendTelegramReport(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("[telegramReports] Missing TELEGRAM_BOT_TOKEN_REPORTS or TELEGRAM_CHAT_ID_REPORTS");
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      console.error("[telegramReports] Telegram API error:", await res.text());
    }
  } catch (err) {
    console.error("[telegramReports] Failed to send:", err.message);
  }
}

export function notifyQuizCompleted({
  eventName,
  name,
  email,
  phone,
  age,
  gender,
  sensitive,
  skinType,
  concerns,
  specialConditions,
  visitorId,
}) {
  const text =
    `🧴 <b>${eventName}</b>\n` +
    `👤 Name: ${name || "Guest"}\n` +
    `📧 Email: ${email || "-"}\n` +
    `📱 Phone: ${phone || "-"}\n` +
    `🎂 Age: ${age || "-"}\n` +
    `⚧ Gender: ${gender || "-"}\n` +
    `✨ Skin Type: ${skinType || "-"}\n` +
    `🌿 Sensitive: ${sensitive === true ? "Yes" : sensitive === false ? "No" : "-"}\n` +
    `🔍 Concerns: ${Array.isArray(concerns) ? concerns.join(", ") : concerns || "-"}\n` +
    `⚠️ Special Condition: ${Array.isArray(specialConditions) ? specialConditions.join(", ") : specialConditions || "-"}\n` +
    `🆔 Visitor: ${visitorId || "-"}\n` +
    `🌐 matchmyskin.roopsee.com`;
  return sendTelegramReport(text);
}

export function notifyOtpVerified({ eventName, phone, email, name, visitorId, isNewUser }) {
  const text =
    `🔐 <b>${eventName}</b>\n` +
    `👤 Name: ${name || "-"}\n` +
    `📱 Phone: ${phone || "-"}\n` +
    `📧 Email: ${email || "-"}\n` +
    `🆕 New User: ${isNewUser === true ? "Yes" : isNewUser === false ? "No" : "-"}\n` +
    `🆔 Visitor: ${visitorId || "-"}\n` +
    `🌐 matchmyskin.roopsee.com`;
  return sendTelegramReport(text);
}

export function notifyLoginSuccessful({ eventName, name, phone, email, method, visitorId }) {
  const text =
    `✅ <b>${eventName}</b>\n` +
    `👤 Name: ${name || "User"}\n` +
    `📱 Phone: ${phone || "-"}\n` +
    `📧 Email: ${email || "-"}\n` +
    `🔑 Method: ${method || "OTP"}\n` +
    `🆔 Visitor: ${visitorId || "-"}\n` +
    `🌐 matchmyskin.roopsee.com`;
  return sendTelegramReport(text);
}