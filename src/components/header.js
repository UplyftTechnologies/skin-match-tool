"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { BiHeart } from "react-icons/bi";
import { IoPersonCircleOutline } from "react-icons/io5";
import { FaCartShopping } from "react-icons/fa6";
import { supabase } from "@/lib/supabase/client";
import { useWishlist } from "@/context/WishlistContext";
import { useRoutineCount } from "@/hooks/use-routine-count";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";
import { FiSunrise } from "react-icons/fi";

export const Logo = ({ dark, onClick }) => (
  <div
    onClick={onClick}
    style={{
      fontSize: 26,
      fontWeight: 600,
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

function IconButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="w-[30px] h-[30px] flex items-center justify-center rounded-full border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors duration-200"
    >
      {children}
    </button>
  );
}

const announcements = [
  'Free Registration',
  'Save Skin Profile',
  'Save Wishlist',
  'Price Drop Alert',
  'Compare Prices',
  'Choose Shop & Buy',
]

  function AnnouncementBar() {
  const track = [...announcements, ...announcements]

  return (
    <div className="w-full overflow-hidden bg-black ring-1 ring-inset ring-[#ca58ff]">
      {/* screen-reader accessible copy, marquee itself is aria-hidden */}
      <span className="sr-only">{announcements.join(', ')}</span>

      <div className="relative w-full overflow-hidden" aria-hidden="true">
        <div className="flex w-max animate-announcement-scroll items-center">
          {track.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="flex shrink-0 items-center gap-2 px-3 py-2 font-lato text-[11px] font-semibold uppercase leading-none tracking-wide text-white whitespace-nowrap sm:gap-3 sm:px-4 sm:py-2 sm:text-[12px] md:text-[13px]"
            >
              {item}
              <span className="text-[#ca58ff]" aria-hidden="true">•</span>
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes announcement-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-announcement-scroll {
          animation: announcement-scroll 22s linear infinite;
        }
        .animate-announcement-scroll:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-announcement-scroll {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
export default function Header({ className = "" }) {
  const [userSession, setUserSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const { wishlistIds } = useWishlist();
  const routineCount = useRoutineCount();
  const router = useRouter();
  const pathname = usePathname();
  const showNavigationFlow = pathname === "/";

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
      <div className={`sticky top-0 z-[var(--z-header)] w-full max-w-none !mt-0 bg-[#faf7f2] border-b border-gray-100 ${className}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 lg:px-6 py-2">
          <Logo dark={false} onClick={handleLogoClick} />

          <div className="flex items-center gap-2">
          {(routineCount > 0 || (sessionLoaded && userSession)) && (
            <Link
              href="/build-routine"
              aria-label="View my routine"
              className="relative flex items-center gap-1.5 text-xs font-medium text-gray-700"
              onClick={() =>
                trackingService.trackEvent(EVENTS.CLICKED_VIEW_ALL_PRODUCTS, {
                  source: "header_routine_icon",
                  routine_count: routineCount,
                })
              }
            >
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-gray-300">
                <FiSunrise size={15} />
              </span>
              {sessionLoaded && userSession ? <span>My Routine</span> : null}
              {routineCount > 0 ? (
              <span className="absolute -top-1 -right-1 bg-[#e01a7f] text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {routineCount}
              </span>
              ) : null}
            </Link>
          )}
          {sessionLoaded && userSession && wishlistIds.length > 0 && (
            <Link
              href="/wishlist"
              aria-label="View wishlist"
              className="relative"
              onClick={() =>
                trackingService.trackEvent(EVENTS.CLICKED_WISHLIST_ICON, {
                  wishlist_count: wishlistIds.length,
                })
              }
            >
              <IconButton>
                <BiHeart size={18} />
              </IconButton>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {wishlistIds.length}
              </span>
            </Link>
          )}

          {/* Profile stays in the mobile bottom nav; desktop keeps an icon-only shortcut. */}
          {sessionLoaded && userSession && (
            <Link
              href="/profile"
              aria-label="My profile"
              className="hidden md:flex items-center justify-center
               h-8 w-8 rounded-full 
               text-gray-700 
               hover:bg-gray-100 transition-colors duration-200"
              onClick={() => trackingService.trackEvent(EVENTS.CLICKED_PROFILE_ICON)}
            >
              <IoPersonCircleOutline  size={42} />
            </Link>
          )}

          {/* Guests get a visible login action because the bottom nav is hidden until login. */}
          {sessionLoaded && !userSession && (
            <button
              type="button"
              onClick={() => {
                trackingService.trackEvent(EVENTS.CLICKED_LOGIN, {
                  source: "header",
                  path: pathname || "/",
                });
                router.push(`/login?redirect=${encodeURIComponent(pathname || "/")}`);
              }}
              className="flex ml-1 h-9 items-center justify-center rounded-full border border-gray-300 px-4
              text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200"
            >
              Login
            </button>
          )}
          </div>
        </div>
      </div>
      <AnnouncementBar />
      {showNavigationFlow && (
        <nav
          aria-label="How Roopsee works"
          className="border-t border-black/5 bg-white px-1 lg:px-4"
        >
          <ol className="relative mx-auto grid max-w-2xl grid-cols-4 py-2.5 sm:py-3">
            <span
              aria-hidden="true"
              className="absolute left-[12.5%] right-[12.5%] top-[17px] h-px bg-[#ead8d3] sm:top-[19px]"
            />
            {["Take Quiz", "Check Skin Match", "Compare Products", "Buy"].map((label) => (
              <li
                key={label}
                className="relative flex min-w-0 flex-col items-center gap-1.5 px-1 text-center text-[9px] font-medium leading-tight text-gray-600 sm:text-xs"
              >
                <span className="relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#d9aaa2] bg-white sm:h-4 sm:w-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#e8c8c2]" />
                </span>
                <span className="block max-w-full">{label}</span>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </>
  );
}
