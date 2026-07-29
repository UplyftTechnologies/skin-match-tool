"use client";

import { useEffect, useRef } from "react";

const SCROLL_POS_KEY = "roopsee_home_scroll_pos";

export default function ScrollRestoreGuard() {
  const isRestoringRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    let ticking = false;
    const saveScroll = () => {
      if (isRestoringRef.current) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (window.location.pathname === "/") {
          sessionStorage.setItem(SCROLL_POS_KEY, String(window.scrollY));
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", saveScroll, { passive: true });

    let pollTimeout = null;

    const forceRestore = () => {
      if (window.location.pathname !== "/") return;

      const saved = Number(sessionStorage.getItem(SCROLL_POS_KEY));
      if (!Number.isFinite(saved) || saved <= 0) return;

      isRestoringRef.current = true;
      // Hide immediately so no intermediate/empty state is ever visible
      document.documentElement.style.visibility = "hidden";

      let attempts = 0;
      const maxAttempts = 40; // hard cap ~1s so we never hide forever

      const tick = () => {
        attempts += 1;
        window.scrollTo(0, saved);

        // Only reveal once the page is actually tall enough to hold this scroll position
        const tallEnough = document.documentElement.scrollHeight >= saved + window.innerHeight;

        if (tallEnough || attempts >= maxAttempts) {
          window.scrollTo(0, saved);
          document.documentElement.style.visibility = "visible";
          isRestoringRef.current = false;
          return;
        }

        pollTimeout = setTimeout(tick, 25);
      };

      requestAnimationFrame(tick);
    };

    window.addEventListener("popstate", forceRestore);

    return () => {
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("popstate", forceRestore);
      if (pollTimeout) clearTimeout(pollTimeout);
      document.documentElement.style.visibility = "visible";
    };
  }, []);

  return null;
}