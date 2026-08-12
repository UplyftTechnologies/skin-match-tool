// components/tracking/how-it-works-cta.js
"use client";

import Link from "next/link";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export default function HowItWorksCta({ href, className, children, position }) {
  function handleClick() {
    trackingService.trackEvent(EVENTS.CLICKED_HOW_IT_WORKS_CTA, { href, position });
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
