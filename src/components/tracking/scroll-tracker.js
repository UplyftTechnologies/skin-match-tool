// components/tracking/scroll-tracker.js
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackingService } from "@/lib/tracking/trackingClient";

// Routes whose folder/param name wouldn't read well once slugified
// (dynamic segments, or names that don't match the site's page vocabulary).
const EXACT_ROUTES = {
  "/": "home_page",
  "/MatchStudio": "match_studio_page",
  "/AllProducts": "products_page",
  "/login": "login_page",
  "/profile": "profile_page",
  "/wishlist": "wishlist_page",
};

const PREFIX_ROUTES = [
  { prefix: "/products/", name: "product_details_page" },
  { prefix: "/retailer-products/", name: "retailer_product_page" },
  { prefix: "/skincare-for/", name: "skincare_for_page" },
];

function pageNameFromPath(pathname) {
  if (!pathname) return "unknown_page";
  if (EXACT_ROUTES[pathname]) return EXACT_ROUTES[pathname];

  const prefixMatch = PREFIX_ROUTES.find((route) => pathname.startsWith(route.prefix));
  if (prefixMatch) return prefixMatch.name;

  const sanitized = pathname
    .replace(/^\/|\/$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase();

  return sanitized ? `${sanitized}_page` : "unknown_page";
}

// Fires once per page visit, the first time the visitor actually scrolls —
// not on mount, so it reflects real engagement rather than page load.
export default function ScrollTracker() {
  const pathname = usePathname();
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;

    function handleScroll() {
      if (firedRef.current || window.scrollY < 40) return;
      firedRef.current = true;
      trackingService.trackScroll(pageNameFromPath(pathname));
      window.removeEventListener("scroll", handleScroll);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return null;
}
