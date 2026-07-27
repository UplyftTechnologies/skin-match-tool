// components/tracking/site-exit-tracker.js
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackingService } from "@/lib/tracking/trackingClient";

export default function SiteExitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // A route change means we didn't actually leave the site — reset so the
    // next real exit from this new page can still fire.
    trackingService.resetExitFlag();
  }, [pathname]);

  useEffect(() => {
    function handleExit() {
      trackingService.trackPageLeave(pathname || "unknown");
    }

    window.addEventListener("pagehide", handleExit);

    return () => {
      window.removeEventListener("pagehide", handleExit);
    };
  }, [pathname]);

  return null;
}