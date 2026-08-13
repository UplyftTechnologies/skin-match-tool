import { supabaseAdmin, supabaseAuth } from "@/lib/supabase/server";
import { EVENTS } from "@/lib/tracking/events";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 120;
const MAX_ANSWER_ITEMS = 20;

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function cleanTextArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_ANSWER_ITEMS)
    .map(cleanText)
    .filter(Boolean);
}

function normalizeProfile(value) {
  const profile = value && typeof value === "object" ? value : {};
  return {
    age: cleanText(profile.age),
    selectedGender: cleanText(profile.selectedGender),
    selectedSkinType: cleanText(profile.selectedSkinType),
    selectedSensitive: typeof profile.selectedSensitive === "boolean"
      ? profile.selectedSensitive
      : null,
    selectedFaceBodyConcerns: cleanTextArray(profile.selectedFaceBodyConcerns),
    selectedLipsEyesConcerns: cleanTextArray(profile.selectedLipsEyesConcerns),
    selectedSpecialConditions: cleanTextArray(profile.selectedSpecialConditions),
  };
}

function isComplete(profile) {
  return Boolean(
    profile.age
    && profile.selectedGender
    && profile.selectedSkinType
    && profile.selectedSensitive !== null
    && profile.selectedFaceBodyConcerns.length
    && profile.selectedSpecialConditions.length
  );
}

async function authenticatedUser(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
  return error ? null : data.user;
}

function userPhone(user) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  return cleanText(
    user.phone
    || metadata.phone_no
    || metadata.phone
    || "",
  ) || null;
}

async function nextQuizNumber(userId, guestSessionId) {
  let query = supabaseAdmin
    .from("quiz_results")
    .select("quiz_number")
    .order("quiz_number", { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("guest_session_id", guestSessionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Number(data?.[0]?.quiz_number || 0) + 1;
}

export async function GET(request) {
  const user = await authenticatedUser(request);
  if (!user) {
    return Response.json({ error: "Authentication is required" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("quiz_results")
      .select("answers, quiz_number, completed_at")
      .eq("user_id", user.id)
      .order("quiz_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return Response.json({ ok: true, result: data || null });
  } catch (error) {
    console.error("[api/quiz-results] Latest quiz result fetch failed:", error);
    return Response.json(
      {
        error: "Unable to fetch quiz result",
        code: error?.code || "QUIZ_RESULT_FETCH_FAILED",
      },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profile = normalizeProfile(body?.profile);
  if (!isComplete(profile)) {
    return Response.json({ error: "A complete quiz profile is required" }, { status: 400 });
  }

  const user = await authenticatedUser(request);
  const guestSessionId = cleanText(body?.guestSessionId) || crypto.randomUUID();

  try {
    const quizNumber = await nextQuizNumber(user?.id || null, guestSessionId);
    const timestamp = new Date().toISOString();
    const keySkinConcerns = [
      ...profile.selectedFaceBodyConcerns,
      ...profile.selectedLipsEyesConcerns,
    ];

    const isFirstQuiz = quizNumber === 1;
    const telegramEventName = isFirstQuiz ? EVENTS.QUIZ_COMPLETED : EVENTS.QUIZ_UPDATED;

    const { data, error } = await supabaseAdmin
      .from("quiz_results")
      .insert({
        user_id: user?.id || null,
        gender: profile.selectedGender,
        answers: profile,
        completed_at: timestamp,
        quiz_number: quizNumber,
        created_at: timestamp,
        age: profile.age,
        key_skin_concerns: keySkinConcerns,
        phone_no: userPhone(user),
        skin_type: profile.selectedSkinType,
        guest_session_id: guestSessionId,
      })
      .select("id, quiz_number, completed_at")
      .single();

    if (error) throw error;

 

    return Response.json({ ok: true, result: data }, { status: 201 });
  } catch (error) {
    console.error("[api/quiz-results] Quiz result insert failed:", error);
    return Response.json(
      {
        error: "Unable to save quiz result",
        code: error?.code || "QUIZ_RESULT_INSERT_FAILED",
      },
      { status: 500 },
    );
  }
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

  const guestSessionId = cleanText(body?.guestSessionId);
  if (!guestSessionId) {
    return Response.json({ error: "guestSessionId is required" }, { status: 400 });
  }

  const phoneNumber = userPhone(user);
  if (!phoneNumber) {
    return Response.json({ error: "No verified phone number was found" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("quiz_results")
      .update({
        user_id: user.id,
        phone_no: phoneNumber,
      })
      .eq("guest_session_id", guestSessionId)
      .is("user_id", null)
      .select("id");

    if (error) throw error;

    return Response.json({
      ok: true,
      updated: data?.length || 0,
    });
  } catch (error) {
    console.error("[api/quiz-results] Guest quiz claim failed:", error);
    return Response.json(
      {
        error: "Unable to attach the phone number to quiz results",
        code: error?.code || "QUIZ_RESULT_CLAIM_FAILED",
      },
      { status: 500 },
    );
  }
}