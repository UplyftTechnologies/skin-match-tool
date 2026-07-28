"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const { wishlistIds } = useWishlist();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!userSession) return null;

  const phone =
    userSession.user?.phone ||
    userSession.user?.user_metadata?.phone_no ||
    userSession.user?.user_metadata?.phone ||
    "User";

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
            <Logo
              dark={false}
              onClick={() => {
                trackingService.trackEvent(EVENTS.CLICKED_LOGO, {
                  clickedFrom: "navbar_logo",
                  path: "/",
                  userName: phone,
                });

                router.push("/");
              }}
            />
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
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
          </div>
        </div>
      </header>
    </>
  );
}