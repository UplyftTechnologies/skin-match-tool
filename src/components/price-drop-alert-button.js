"use client";

import { useEffect, useState } from "react";
import { FiBell, FiBellOff } from "react-icons/fi";
import {
  fetchPriceDropAlertStatus,
  subscribePriceDropAlert,
  unsubscribePriceDropAlert,
} from "@/lib/push/price-alert";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export default function PriceDropAlertButton({ product, className }) {
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPriceDropAlertStatus(product.product_uid).then((isSubscribed) => {
      if (!cancelled) setSubscribed(isSubscribed);
    });
    return () => {
      cancelled = true;
    };
  }, [product.product_uid]);

  async function handleClick() {
    if (pending) return;
    setPending(true);

    try {
      if (subscribed) {
        const ok = await unsubscribePriceDropAlert(product);
        if (ok) {
          setSubscribed(false);
          trackingService.trackEvent(EVENTS.CLICKED_CANCEL_PRICE_ALERT, {
            productId: product.product_uid,
            productName: product.product_name,
          });
        }
      } else {
        const ok = await subscribePriceDropAlert(product);
        if (ok) {
          setSubscribed(true);
          trackingService.trackEvent(EVENTS.CLICKED_GET_PRICE_DROP_ALERT, {
            productId: product.product_uid,
            productName: product.product_name,
            watchPrice: product.selling_price || product.mrp,
          });
        }
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
      aria-pressed={subscribed}
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-full border border-[#e08a7d] px-4 py-2 text-[12.5px] font-semibold text-[#d77465] transition hover:bg-[#fdf0ee] disabled:opacity-60"
      }
    >
      {subscribed ? <FiBell aria-hidden="true" className="h-3.5 w-3.5" /> : <FiBellOff aria-hidden="true" className="h-3.5 w-3.5" />}
      {subscribed ? "Price alert set" : "Get price drop alert"}
    </button>
  );
}
