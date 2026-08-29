"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function MetaPixelPageView() {
  const pathname = usePathname();
  const initialPageViewTracked = useRef(false);

  useEffect(() => {
    // The base snippet records the initial load. Only record subsequent
    // client-side route changes here so the first PageView is not duplicated.
    if (!initialPageViewTracked.current) {
      initialPageViewTracked.current = true;
      return;
    }

    window.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
