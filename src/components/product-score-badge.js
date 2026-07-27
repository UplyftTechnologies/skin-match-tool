"use client";

import { useEffect, useState } from "react";

function scoreBand(score) {
  if (score >= 80) return { label: "Good", className: "good" };
  if (score >= 60) return { label: "Present", className: "present" };
  return { label: "Weak", className: "weak" };
}

export default function ProductScoreBadge() {
  const [score, setScore] = useState(null);

  useEffect(() => {
    const updateTimer = window.setTimeout(() => {
      const value = Number(new URLSearchParams(window.location.search).get("score"));
      if (Number.isFinite(value) && value >= 0 && value <= 100) {
        setScore(value);
      }
    }, 0);

    return () => window.clearTimeout(updateTimer);
  }, []);

  if (score === null) return null;

  const band = scoreBand(score);
  return (
    <div className={`score-badge score-${band.className}`}>
      <div>
        {score}
        <small>{band.label}</small>
      </div>
    </div>
  );
}
