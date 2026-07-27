// components/save-product-link.js
"use client";

import Link from "next/link";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export default function SaveProductLink({ product, className, children }) {
  function handleClick() {
    trackingService.trackEvent(EVENTS.CLICKED_SAVE_PRODUCT, {
      productId: product.product_uid,
      productName: product.product_name,
      brand: product.brand_name,
      price: product.sp || product.mrp,
    });
  }

  return (
    <Link href="/" className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}