// context/WishlistContext.js
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { triggerWishlistReminder } from "@/lib/push/wishlist-reminder";
import { supabase } from "@/lib/supabase/client";

const WishlistContext = createContext(null);
const STORAGE_KEY = "wishlist_products";

export function WishlistProvider({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [wishlistItems, setWishlistItems] = useState([]); // array of full product objects
    const [hydrated, setHydrated] = useState(false);
    const [userSession, setUserSession] = useState(null);

    useEffect(() => {
        let active = true;

        const applySession = (session) => {
            if (!active) return;
            setUserSession(session);

            if (!session) {
                localStorage.removeItem(STORAGE_KEY);
                setWishlistItems([]);
            } else {
                try {
                    setWishlistItems(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
                } catch {
                    setWishlistItems([]);
                }
            }
            setHydrated(true);
        };

        supabase.auth.getSession().then(({ data: { session } }) => applySession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            applySession(session);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (hydrated && userSession) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlistItems));
        }
    }, [wishlistItems, hydrated, userSession]);

    const wishlistIds = wishlistItems.map((item) => item.product_uid);

    function isWishlisted(productUid) {
        return wishlistIds.includes(productUid);
    }

    function toggleWishlist(product) {
        if (!userSession) {
            const redirect = pathname && pathname !== "/login" ? pathname : "/";
            router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
            return false;
        }

        const alreadySaved = wishlistItems.some((item) => item.product_uid === product.product_uid);
        setWishlistItems((current) =>
            current.some((item) => item.product_uid === product.product_uid)
                ? current.filter((item) => item.product_uid !== product.product_uid)
                : [...current, product]
        );
        if (!alreadySaved) triggerWishlistReminder(product);
        return true;
    }

    function removeFromWishlist(productUid) {
        setWishlistItems((current) => current.filter((item) => item.product_uid !== productUid));
    }
    function clearWishlist() {
        setWishlistItems([]);
    }

    return (
        <WishlistContext.Provider
            value={{ wishlistItems, wishlistIds, isWishlisted, toggleWishlist, removeFromWishlist, clearWishlist, hydrated }}
        >
            {children}
        </WishlistContext.Provider>
    );
}

export function useWishlist() {
    const ctx = useContext(WishlistContext);
    if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
    return ctx;
}
