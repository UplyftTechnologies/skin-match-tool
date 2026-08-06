// context/WishlistContext.js
"use client";

import { createContext, useContext, useEffect, useState } from "react";

const WishlistContext = createContext(null);
const STORAGE_KEY = "wishlist_products";

export function WishlistProvider({ children }) {
    const [wishlistItems, setWishlistItems] = useState([]); // array of full product objects
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            setWishlistItems(stored);
        } catch {
            setWishlistItems([]);
        } finally {
            setHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (hydrated) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlistItems));
        }
    }, [wishlistItems, hydrated]);

    const wishlistIds = wishlistItems.map((item) => item.product_uid);

    function isWishlisted(productUid) {
        return wishlistIds.includes(productUid);
    }

    function toggleWishlist(product) {
        setWishlistItems((current) =>
            current.some((item) => item.product_uid === product.product_uid)
                ? current.filter((item) => item.product_uid !== product.product_uid)
                : [...current, product]
        );
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
