"use client";

import { useEffect, useState } from "react";

function scoreBand(score) {
  if (score >= 80) return { label: "Great", className: "great" };
  if (score >= 60) return { label: "Caution", className: "caution" };
  return { label: "Poor", className: "poor" };
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
