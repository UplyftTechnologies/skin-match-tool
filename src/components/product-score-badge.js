"use client";

import { useEffect, useState } from "react";
import { useQuizAnswers } from "@/hooks/use-quiz-answers";

function clampScore(score) {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

function scoreBand(score) {
  if (score >= 80) return { label: "Great", className: "great" };
  if (score >= 60) return { label: "Caution", className: "caution" };
  return { label: "Poor", className: "poor" };
}

function scoreRange(score) {
  if (score >= 90) return "90_100";
  if (score >= 80) return "80_89";
  if (score >= 70) return "70_79";
  if (score >= 60) return "60_69";
  if (score >= 50) return "50_59";
  return "below50";
}

const SCORE_RANGE_COLORS = {
  "90_100": "#197A4D",
  "80_89": "#22c55e",
  "70_79": "#E6C157",
  "60_69": "#f97316",
  "50_59": "#f43f5e",
  below50: "#dc2626",
};

function scoreColor(score) {
  return SCORE_RANGE_COLORS[scoreRange(score)];
}

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

  const band = scoreBand(score);
  return (
    <div
      className={`score-badge score-${band.className}`}
      style={{ backgroundColor: scoreColor(score) }}
    >
      <div>
        {score}
        <small>{band.label}</small>
      </div>
    </div>
  );
}
