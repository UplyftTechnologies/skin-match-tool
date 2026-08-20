import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const PARTNER_INQUIRY_TO_EMAIL = process.env.PARTNER_INQUIRY_TO_EMAIL || 'contact@roopsee.com';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const sendPartnerInquiryEmail = async ({ fullName, brandName, workEmail, phoneNumber }) => {
  const client = getTransporter();
  if (!client) {
    console.error('SMTP env vars missing. Partnership inquiry email skipped.');
    return null;
  }

  const html = `
    <h2>New Partnership Inquiry</h2>
    <p><b>Full name:</b> ${escapeHtml(fullName)}</p>
    <p><b>Brand / company:</b> ${escapeHtml(brandName || 'Not provided')}</p>
    <p><b>Work email:</b> ${escapeHtml(workEmail)}</p>
    <p><b>Phone number:</b> ${escapeHtml(phoneNumber || 'Not provided')}</p>
  `;

  try {
    return await client.sendMail({
      from: SMTP_FROM,
      to: PARTNER_INQUIRY_TO_EMAIL,
      replyTo: workEmail,
      subject: `Partnership`,
      html,
    });
  } catch (error) {
    console.error('Partnership inquiry email failed:', error);
    return null;
  }
};
