"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { triggerWishlistReminder } from "@/lib/push/wishlist-reminder";
import { supabase } from "@/lib/supabase/client";
import { WishlistStore, wishlistMatches } from "@/lib/wishlist-store";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const storeRef = useRef(null);
    const [state, setState] = useState({ items: [], hydrated: false, error: "", syncing: false });

    useEffect(() => {
        let active = true;
        let authEventReceived = false;
        const store = new WishlistStore({
            storage: {
                getItem: key => window.localStorage.getItem(key),
                setItem: (key, value) => window.localStorage.setItem(key, value),
            },
            request: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
            onChange: next => { if (active) setState(next); },
        });
        storeRef.current = store;
        // Supabase emits INITIAL_SESSION too. Ignore an older getSession result
        // if an auth event has already established a newer session.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (active && !authEventReceived) void store.setSession(session);
        }).catch(() => {
            if (active && !authEventReceived) {
                setState({ items: [], hydrated: true, syncing: false,
                    error: "Could not check your account. Please reload to retry." });
            }
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            authEventReceived = true;
            if (active) void store.setSession(session);
        });
        const retryOnline = () => { void store.retry(); };
        window.addEventListener("online", retryOnline);
        return () => {
            active = false;
            store.dispose();
            subscription.unsubscribe();
            window.removeEventListener("online", retryOnline);
        };
    }, []);

    const wishlistItems = state.items;
    const wishlistIds = wishlistItems.map(item => String(item.product_uid));
    function isWishlisted(uid) {
        return wishlistItems.some(item => wishlistMatches(item, uid));
    }

    function toggleWishlist(product) {
        const store = storeRef.current;
        if (!store?.hydrated) return false;
        if (!store.session) {
            router.push(`/login?redirect=${encodeURIComponent(pathname && pathname !== "/login" ? pathname : "/")}`);
            return false;
        }
        const existing = store.items.find(item => wishlistMatches(item, product.product_uid));
        const changed = store.change(existing || product, !existing);
        if (changed && !existing) triggerWishlistReminder(product);
        return changed;
    }

    function removeFromWishlist(uid) {
        const store = storeRef.current;
        const product = store?.items.find(item => wishlistMatches(item, uid));
        if (product) store.change(product, false);
    }

    function clearWishlist() {
        // Used after sign-out: clear the screen, keep this account's durable cache.
        void storeRef.current?.setSession(null);
    }

    return (
        <WishlistContext.Provider value={{
            wishlistItems, wishlistIds, isWishlisted, toggleWishlist, removeFromWishlist,
            clearWishlist, hydrated: state.hydrated, error: state.error, syncing: state.syncing,
            retryWishlist: () => storeRef.current?.retry(),
        }}>
            {children}
            {state.error ? (
                <div role="alert" className="fixed bottom-5 left-1/2 z-[100] w-[min(90vw,420px)] -translate-x-1/2 rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700 shadow-lg">
                    {state.error}
                    <button type="button" onClick={() => storeRef.current?.retry()} className="ml-2 font-bold text-[#b8503f] underline">Retry</button>
                </div>
            ) : null}
        </WishlistContext.Provider>
    );
}

export function useWishlist() {
    const context = useContext(WishlistContext);
    if (!context) throw new Error("useWishlist must be used within WishlistProvider");
    return context;
}
