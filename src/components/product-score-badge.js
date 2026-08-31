"use client";

import { useEffect, useState } from "react";
import { useQuizAnswers } from "@/hooks/use-quiz-answers";
import { clampScore, getScoreBand } from "@/lib/score-band";

export default function ProductScoreBadge() {
  const [score, setScore] = useState(null);
  const quizAnswers = useQuizAnswers();

  useEffect(() => {
    const updateTimer = window.setTimeout(() => {
      if (!quizAnswers) {
        setScore(null);
        return;
      }

      const rawValue = new URLSearchParams(window.location.search).get("score");
      const raw = rawValue === null || rawValue.trim() === "" ? NaN : Number(rawValue);
      if (Number.isFinite(raw)) {
        setScore(clampScore(raw));
      } else {
        setScore(null);
      }
    }, 0);

    return () => window.clearTimeout(updateTimer);
  }, [quizAnswers]);

  if (score === null) return null;

  const band = getScoreBand(score);
  return (
    <div
      className={`score-badge score-${band.key}`}
      style={{ backgroundColor: band.fill }}
    >
      <div>
        {score}
        <small>{band.label}</small>
      </div>
    </div>
  );
}
