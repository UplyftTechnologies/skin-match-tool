// components/tracking/page-view-tracker.js
"use client";

import { useEffect } from "react";
import { trackingService } from "@/lib/tracking/trackingClient";

// Generic drop-in for server-component pages that just need a
// PAGE_VIEWED_X fired on mount, without any page-specific data to gather
// (see ProductViewTracker for the pattern this was split out of).
export default function PageViewTracker({ eventName, properties = {} }) {
  useEffect(() => {
    trackingService.trackPageLoad(eventName, properties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName]);

  return null;
}
