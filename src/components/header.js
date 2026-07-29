"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BiHeart } from "react-icons/bi";
import { IoPersonCircleOutline } from "react-icons/io5";
import { supabase } from "@/lib/supabase/client";
import { useWishlist } from "@/context/WishlistContext";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export const Logo = ({ dark, onClick }) => (
  <div
    onClick={onClick}
    style={{
      fontSize: 26,
      fontWeight: 700,
      color: dark ? "#000000" : "#111",
      cursor: "pointer",
      userSelect: "none",
      letterSpacing: "-0.5px",
      flexShrink: 0,
    }}
  >
    roopsee<span style={{ color: "#ff00e6", fontSize: 22 }}>.</span>
  </div>
);

export default function Header() {
  const [userSession, setUserSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const { wishlistIds } = useWishlist();
  const router = useRouter();
  const pathname = usePathname(); // NEW

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session);
      setSessionLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserSession(session);
      setSessionLoaded(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const phone =
    userSession?.user?.phone ||
    userSession?.user?.user_metadata?.phone_no ||
    userSession?.user?.user_metadata?.phone ||
    "User";

  // NEW: handle logo click — always scroll to top, whether already on "/" or navigating there
  function handleLogoClick() {
    trackingService.trackEvent(EVENTS.CLICKED_LOGO, {
      clickedFrom: "navbar_logo",
      path: "/",
      userName: phone,
    });

    if (pathname === "/") {
      // Already on home — router.push to the same route is a no-op, so scroll manually.
      // Also clear the saved scroll position so a later browser-back doesn't
      // pull the user back down after they explicitly asked to go to top.
      try {
        sessionStorage.removeItem("roopsee_home_scroll_pos");
      } catch {
        // ignore storage errors
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push("/");
    }
  }

  return (
    <>
      <style>{`
        .navbar-logo-slot {
          display: flex;
          align-items: center;
          justify-self: start;
          min-width: 0;
          flex-shrink: 0;
        }
      `}</style>

      <header className="lg:px-6 mx-auto sticky top-0 z-[999]">
        <div className="user-greeting-bar">
          <div className="navbar-logo-slot">
            <Logo dark={false} onClick={handleLogoClick} />
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            {userSession ? (
              <>
                {wishlistIds.length > 0 && (
                  <Link
                    href="/wishlist"
                    aria-label="View wishlist"
                    className="relative flex items-center"
                    onClick={() =>
                      trackingService.trackEvent(EVENTS.CLICKED_WISHLIST_ICON, {
                        wishlist_count: wishlistIds.length,
                      })
                    }
                  >
                    <BiHeart className="text-gray-800" size={22} />
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                      {wishlistIds.length}
                    </span>
                  </Link>
                )}

                <Link
                  href="/profile"
                  aria-label="View your skin profile"
                  className="flex items-center text-gray-800"
                  onClick={() => trackingService.trackEvent(EVENTS.CLICKED_PROFILE_ICON)}
                >
                  <IoPersonCircleOutline size={24} />
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}