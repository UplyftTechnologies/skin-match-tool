import { supabaseAdmin } from "@/lib/supabase/server";
import { sendPartnerInquiryEmail } from "@/lib/email/sendPartnerInquiryEmail";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value, maxLength = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fullName = cleanText(body?.fullName);
  const brandName = cleanText(body?.brandName);
  const workEmail = cleanText(body?.workEmail);
  const phoneNumber = cleanText(body?.phoneNumber, 30);

  if (!fullName || !workEmail || !EMAIL_RE.test(workEmail)) {
    return Response.json({ error: "Full name and a valid work email are required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("partnership_inquiries")
      .insert({
        full_name: fullName,
        brand_name: brandName || null,
        work_email: workEmail,
        phone_number: phoneNumber || null,
      })
      .select("id, created_at")
      .single();

    if (error) throw error;

    await sendPartnerInquiryEmail({ fullName, brandName, workEmail, phoneNumber });

    return Response.json({ ok: true, id: data.id });
  } catch (error) {
    console.error("[api/partner/inquiry] Failed to save partnership inquiry:", error.message);
    return Response.json({ error: "Unable to submit partnership inquiry" }, { status: 500 });
  }
}
