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

    let forceInterval = null;
    let revealTimeout = null;

    const forceRestore = () => {
      if (window.location.pathname !== "/") return;

      const saved = Number(sessionStorage.getItem(SCROLL_POS_KEY));
      if (!Number.isFinite(saved) || saved <= 0) return;

      isRestoringRef.current = true;

      // NEW: hide the page instantly so the user never sees the top-of-page flash.
      // visibility:hidden (not display:none) keeps layout/height intact so
      // scrollHeight/scrollTo still work normally underneath.
      document.documentElement.style.visibility = "hidden";

      let elapsed = 0;
      const step = 20;
      const maxDuration = 800; // restoring happens fast since data is already in sessionStorage

      if (forceInterval) clearInterval(forceInterval);
      if (revealTimeout) clearTimeout(revealTimeout);

      forceInterval = setInterval(() => {
        window.scrollTo(0, saved);
        elapsed += step;
        if (elapsed >= maxDuration) {
          clearInterval(forceInterval);
          forceInterval = null;
        }
      }, step);

      // Reveal shortly after — long enough for the DOM to have the restored
      // height/content, short enough that it still feels instant.
      revealTimeout = setTimeout(() => {
        window.scrollTo(0, saved);
        document.documentElement.style.visibility = "visible";
        isRestoringRef.current = false;
      }, 150);
    };

    window.addEventListener("popstate", forceRestore);

    return () => {
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("popstate", forceRestore);
      if (forceInterval) clearInterval(forceInterval);
      if (revealTimeout) clearTimeout(revealTimeout);
      document.documentElement.style.visibility = "visible";
    };
  }, []);

  return null;
}