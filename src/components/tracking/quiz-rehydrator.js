// components/tracking/quiz-rehydrator.js
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { saveSkinProfile } from "@/lib/profile-storage";
import { resultProfileToQuizAnswers } from "@/lib/quiz-profile";

const QUIZ_ANSWERS_KEY = "roopsee-quiz-answers";

// On login, if this tab doesn't already have quiz answers in sessionStorage
// (fresh tab, or right after logout wiped it), pull the user's last saved
// quiz result from the DB and hydrate local state from it — so a logged-in
// user doesn't have to redo the quiz every time they sign back in.
export default function QuizRehydrator() {
  useEffect(() => {
    let active = true;

    const hydrateFromServer = async (session) => {
      if (!session?.access_token) return;
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
