// lib/profile-storage.js
import { quizAnswersToResultProfile } from "@/lib/quiz-profile";

const PROFILE_KEY = "roopsee_skin_profile";
const NEW_DESIGN_QUIZ_KEY = "roopsee-quiz-answers";

export function saveSkinProfile(profile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ profile, savedAt: new Date().toISOString() })
    );
  } catch {
    // ignore write failures (private browsing, storage full, etc.)
  }
}

export function getSavedSkinProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);

    const quizAnswers = JSON.parse(sessionStorage.getItem(NEW_DESIGN_QUIZ_KEY) || "null");
    if (!quizAnswers) return null;

    const savedProfile = {
      profile: quizAnswersToResultProfile(quizAnswers),
      savedAt: null,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(savedProfile));
    return savedProfile;
  } catch {
    return null;
  }
}
