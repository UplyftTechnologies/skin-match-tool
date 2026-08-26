"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IoBagHandle,
  IoBagHandleOutline,
  IoHome,
  IoHomeOutline,
  IoPersonCircle,
  IoPersonCircleOutline,
} from "react-icons/io5";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

const ACTIVE_COLOR = "#ff00e6";

export default function BottomNav() {
  const pathname = usePathname();

  const isHomeActive = pathname === "/";
  const isShopActive = pathname?.startsWith("/AllProducts");
  const isProfileActive = pathname?.startsWith("/profile");

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[var(--z-bottom-nav)] pb-safe bg-white border-t border-gray-200"
    >
      <div className="flex items-stretch justify-around">
        <Link
          href="/"
          aria-label="Home"
          className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1"
          onClick={() => trackingService.trackEvent(EVENTS.CLICKED_LOGO, { clickedFrom: "bottom_nav_home" })}
        >
          {isHomeActive ? (
            <IoHome size={22} color={ACTIVE_COLOR} />
          ) : (
            <IoHomeOutline size={22} className="text-gray-500" />
          )}
          <span
            className="text-[11px] font-medium"
            style={{ color: isHomeActive ? ACTIVE_COLOR : "#6b7280" }}
          >
            Home
          </span>
        </Link>

        <Link
          href="/AllProducts"
          aria-label="Shop all products"
          className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1"
          onClick={() =>
            trackingService.trackEvent(EVENTS.CLICKED_VIEW_ALL_PRODUCTS, {
              clickedFrom: "bottom_nav_shop",
            })
          }
        >
          {isShopActive ? (
            <IoBagHandle size={22} color={ACTIVE_COLOR} />
          ) : (
            <IoBagHandleOutline size={22} className="text-gray-500" />
          )}
          <span
            className="text-[11px] font-medium"
            style={{ color: isShopActive ? ACTIVE_COLOR : "#6b7280" }}
          >
            Shop
          </span>
        </Link>

        <Link
          href="/profile"
          aria-label="My profile"
          className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1"
          onClick={() => trackingService.trackEvent(EVENTS.CLICKED_PROFILE_ICON, { clickedFrom: "bottom_nav" })}
        >
          {isProfileActive ? (
            <IoPersonCircle size={22} color={ACTIVE_COLOR} />
          ) : (
            <IoPersonCircleOutline size={22} className="text-gray-500" />
          )}
          <span
            className="text-[11px] font-medium"
            style={{ color: isProfileActive ? ACTIVE_COLOR : "#6b7280" }}
          >
            Profile
          </span>
        </Link>
      </div>
    </nav>
  );
}
