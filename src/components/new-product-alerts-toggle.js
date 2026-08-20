"use client";

import { useEffect, useState } from "react";
import { FiBell, FiBellOff } from "react-icons/fi";
import { fetchNewProductAlertsEnabled, setNewProductAlertsEnabled } from "@/lib/push/new-products-alert";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export default function NewProductAlertsToggle({ className, source = "all_products" }) {
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchNewProductAlertsEnabled().then((isEnabled) => {
      if (!cancelled) setEnabled(isEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    const next = !enabled;

    try {
      const ok = await setNewProductAlertsEnabled(next);
      if (ok) {
        setEnabled(next);
        trackingService.trackEvent(
          next ? EVENTS.CLICKED_ENABLE_NEW_PRODUCT_ALERTS : EVENTS.CLICKED_DISABLE_NEW_PRODUCT_ALERTS,
          { source },
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={enabled}
      className={
        className ||
        "inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-[#e08a7d] disabled:opacity-60"
      }
    >
      {enabled ? (
        <FiBell aria-hidden="true" className="h-3.5 w-3.5 text-[#e08a7d]" />
      ) : (
        <FiBellOff aria-hidden="true" className="h-3.5 w-3.5" />
      )}
      {enabled ? "New product alerts on" : "Notify me about new products"}
    </button>
  );
}
