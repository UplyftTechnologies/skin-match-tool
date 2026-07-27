// components/tracking/product-view-tracker.js
"use client";

import { useEffect } from "react";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export default function ProductViewTracker({ product }) {
  useEffect(() => {
    trackingService.trackPageLoad(EVENTS.PAGE_VIEWED_PRODUCT_DETAILS, {
      productId: product.product_uid,
      productName: product.product_name,
      brand: product.brand_name,
      price: product.sp || product.mrp,
      category: product.category,
    });
  }, [product.product_uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}