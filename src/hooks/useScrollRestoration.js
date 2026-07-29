"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "scroll-pos:";

export function useScrollRestoration(readyKey = true) {
  const pathname = usePathname();

  // Save scroll position continuously while on this page
  useEffect(() => {
    const key = STORAGE_PREFIX + pathname;

    const saveScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };

    window.addEventListener("scroll", saveScroll, { passive: true });
    // also save right before leaving the page
    window.addEventListener("beforeunload", saveScroll);

    return () => {
      saveScroll(); // save on unmount (covers client-side nav away)
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, [pathname]);

  // Restore scroll position once content is "ready" (e.g. list finished loading)
  useEffect(() => {
    if (!readyKey) return; // wait until caller says content is rendered

    const key = STORAGE_PREFIX + pathname;
    const saved = sessionStorage.getItem(key);
    if (saved == null) return;

    const y = Number(saved);
    if (!Number.isFinite(y)) return;

    // wait a tick so DOM has painted the restored content
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "instant" });
    });
  }, [pathname, readyKey]);
}