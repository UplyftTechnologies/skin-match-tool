// components/tracking/quiz-rehydrator.js
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { saveSkinProfile } from "@/lib/profile-storage";
import { resultProfileToQuizAnswers } from "@/lib/quiz-profile";
import { getSessionId } from "@/lib/tracking/identity";

const QUIZ_ANSWERS_KEY = "roopsee-quiz-answers";

// Attaches whatever guest quiz result this browser session took (tracked via
// guestSessionId, stamped on every POST to /api/quiz-results) to the account
// that just signed in — a no-op if there's nothing to claim, or it's already
// claimed. This used to only run inside match-studio.js's own auth listener,
// which meant signing in from any other page (e.g. the login page directly)
// left a guest's just-taken quiz orphaned server-side. Mounted globally
// (see layout.js) so it fires no matter where the user logs in from.
const claimGuestQuizResults = async (session) => {
  if (!session?.access_token) return;

  try {
    await fetch("/api/quiz-results", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ guestSessionId: getSessionId() }),
    });
  } catch (error) {
    console.warn("[quiz-rehydrator] Guest quiz claim failed:", error?.message);
  }
};

// On login, if this tab doesn't already have quiz answers in sessionStorage
// (fresh tab, or right after logout wiped it), pull the user's last saved
// quiz result from the DB and hydrate local state from it — so a logged-in
// user doesn't have to redo the quiz every time they sign back in.
export default function QuizRehydrator() {
  useEffect(() => {
    let active = true;

    const hydrateFromServer = async (session) => {
      if (!session?.access_token) return;
      await claimGuestQuizResults(session);
      if (sessionStorage.getItem(QUIZ_ANSWERS_KEY)) return;

      try {
        const response = await fetch("/api/quiz-results", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!active || !response.ok || !payload?.result?.answers) return;

        const answers = resultProfileToQuizAnswers(payload.result.answers);
        if (!answers) return;

        sessionStorage.setItem(QUIZ_ANSWERS_KEY, JSON.stringify(answers));
        saveSkinProfile(payload.result.answers);
        window.dispatchEvent(
          new CustomEvent("roopsee-quiz-answers-updated", { detail: answers })
        );
      } catch (error) {
        console.warn("[quiz-rehydrator] Failed to restore saved quiz:", error);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => hydrateFromServer(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") hydrateFromServer(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
