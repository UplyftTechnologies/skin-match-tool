"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BiHeart } from "react-icons/bi";
import { HiOutlineMenu } from "react-icons/hi";
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
      className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors duration-200"
    >
      {children}
    </button>
  );
}

export default function Header() {
  const [userSession, setUserSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { wishlistIds } = useWishlist();
  const router = useRouter();

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

  return (
    <header className="sticky top-0 z-[999] bg-[#faf7f2] border-b border-gray-100">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 lg:px-6 py-2">
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

        <div className="flex items-center gap-3">
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
            {wishlistIds.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {wishlistIds.length}
              </span>
            )}
          </Link>

          {/* Desktop: direct profile/login icon, no drawer needed */}
          {sessionLoaded && (
            <Link
              href={userSession ? "/profile" : "/login"}
              aria-label={userSession ? "My profile" : "Login"}
              className="hidden lg:flex items-center gap-2 pl-1 pr-3 h-9 rounded-full border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors duration-200"
              onClick={() =>
                trackingService.trackEvent(
                  userSession ? EVENTS.CLICKED_PROFILE_ICON : EVENTS.CLICKED_LOGIN_ICON
                )
              }
            >
              <IoPersonCircleOutline size={20} />
              <span className="text-sm font-medium">
                {userSession ? "My Profile" : "Login"}
              </span>
            </Link>
          )}

          {/* Mobile/tablet: hamburger opens drawer */}
          <button
            aria-label="Open menu"
            className="block lg:hidden"
            onClick={() => {
              trackingService.trackEvent(EVENTS.CLICKED_MENU_ICON);
              setMenuOpen(true);
            }}
          >
            <HiOutlineMenu size={18} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-0 right-0 h-full w-72 bg-white shadow-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <Logo dark={true} />
              <button onClick={() => setMenuOpen(false)} className="text-2xl leading-none">
                &times;
              </button>
            </div>

            <nav className="flex flex-col gap-4">
              {userSession ? (
                <Link
                  href="/profile"
                  className="flex items-center gap-2 text-gray-800"
                  onClick={() => {
                    trackingService.trackEvent(EVENTS.CLICKED_PROFILE_ICON);
                    setMenuOpen(false);
                  }}
                >
                  <IoPersonCircleOutline size={22} />
                  My Profile
                </Link>
              ) : (
                sessionLoaded && (
                  <Link
                    href="/login"
                    className="flex items-center gap-2 text-gray-800"
                    onClick={() => {
                      trackingService.trackEvent(EVENTS.CLICKED_LOGIN_ICON);
                      setMenuOpen(false);
                    }}
                  >
                    <IoPersonCircleOutline size={22} />
                    Login
                  </Link>
                )
              )}
              <Link href="/wishlist" className="text-gray-800" onClick={() => setMenuOpen(false)}>
                Wishlist
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}