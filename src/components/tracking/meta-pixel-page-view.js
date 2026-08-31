"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function MetaPixelPageView() {
  const pathname = usePathname();
  const initialPageViewTracked = useRef(false);

  useEffect(() => {
    if (!initialPageViewTracked.current) {
      initialPageViewTracked.current = true;
      return;
    }

    window.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
