// app/profile/page.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BiArrowBack, BiChevronRight, BiHeart, BiUser } from "react-icons/bi";
import { FcGoogle } from "react-icons/fc";
import { HiPencil } from "react-icons/hi";
import { IoExitOutline } from "react-icons/io5";
import Serum from "@/assets/images/serum.png";
import { supabase } from "@/lib/supabase/client";
import { useWishlist } from "@/context/WishlistContext";
import { getSavedSkinProfile } from "@/lib/profile-storage";
import { scoredProductPath } from "@/lib/site";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

function ProfileRow({ label, value, isLast }) {
    return (
        <div className={`flex items-center justify-between gap-3 px-4 py-3.5 ${!isLast ? "border-b border-gray-100" : ""}`}>
            <span className="text-[13px] text-gray-500">{label}</span>
            <div className="flex items-center gap-1 min-w-0">
                <span className="min-w-0 truncate text-[14px] font-semibold text-gray-900">{value}</span>
                <BiChevronRight className="shrink-0 text-gray-300" size={18} />
            </div>
        </div>
    );
}

function WishlistCard({ product, onVisit, onRemove }) {
    const mrp = product.mrp;

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-3 flex flex-col items-center text-center">
            <Link
                href={scoredProductPath(product.product_uid, product.score)}
                onClick={() => onVisit(product)}
                className="flex flex-col items-center w-full"
            >
                <div className="relative w-full aspect-square mb-2">
                    <Image
                        src={product.image || Serum}
                        alt={product.product_name || "Skincare product"}
                        fill
                        sizes="(max-width: 639px) 40vw, 25vw"
                        className="object-contain"
                    />
                </div>
                <p className="text-[12px] leading-snug text-gray-700 line-clamp-2">{product.product_name}</p>
            </Link>
            <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[12px] font-semibold text-gray-900">
                    {mrp ? `₹${Math.ceil(mrp)}` : "Price unavailable"}
                </span>
            </div>
            <button
                type="button"
                onClick={() => onRemove(product)}
                className="mt-2 text-[11px] font-medium text-rose-500 hover:text-rose-600 hover:underline"
            >
                Remove from wishlist
            </button>
        </div>
    );
}

export default function ProfilePage() {
    const router = useRouter();
    const { wishlistItems, hydrated, clearWishlist, removeFromWishlist } = useWishlist();
    const [savedProfile, setSavedProfile] = useState(null);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [userSession, setUserSession] = useState(null);
    const [linkingGoogle, setLinkingGoogle] = useState(false);
    const [linkGoogleError, setLinkGoogleError] = useState(() => {
        if (typeof window === "undefined") return "";
        const googleError = new URLSearchParams(window.location.search).get("googleError");
        if (!googleError) return "";
        return googleError.toLowerCase().includes("already linked")
            ? "This Google account is already linked to another account."
            : "Could not link your Google account. Please try again.";
    });

    useEffect(() => {
        const loadTimer = window.setTimeout(() => {
            setSavedProfile(getSavedSkinProfile());
            setProfileLoaded(true);
        }, 0);

        return () => window.clearTimeout(loadTimer);
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserSession(session);
        });
    }, []);

    useEffect(() => {
        if (!window.location.search.includes("googleError")) return;
        router.replace("/profile");
    }, [router]);

    useEffect(() => {
        if (!profileLoaded) return;

        trackingService.trackPageLoad(EVENTS.PAGE_VIEWED_PROFILE, {
            page_type: "profile",
            has_profile: Boolean(savedProfile),
            wishlist_count: wishlistItems.length,
            phone_number: savedProfile?.phone || savedProfile?.profile?.phone || undefined,
        });
    }, [profileLoaded, savedProfile, wishlistItems.length]);

    const profile = savedProfile?.profile;
    const avatarUrl = userSession?.user?.user_metadata?.avatar_url || null;
    const googleLinked = userSession?.user?.identities?.some((identity) => identity.provider === "google") || false;

    const loginMethod =
        userSession?.user?.email ||
        userSession?.user?.phone ||
        userSession?.user?.user_metadata?.phone_no ||
        userSession?.user?.user_metadata?.phone ||
        "—";

    function handleVisit(product) {
        trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
            productId: product.product_uid,
            productName: product.product_name,
            section: "profile_wishlist",
        });
    }

    async function handleLinkGoogle() {
        setLinkingGoogle(true);
        setLinkGoogleError("");
        trackingService.trackEvent(EVENTS.CLICKED_LOGIN, {
            method: "google",
            action: "link_account",
            source: "profile_page",
        });

        try {
            const { error } = await supabase.auth.linkIdentity({
                provider: "google",
                options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent("/profile")}` },
            });
            if (error) throw error;
        } catch (error) {
            console.error("[profile] Google account link failed:", error);
            setLinkGoogleError("Could not link your Google account. Please try again.");
            setLinkingGoogle(false);
        }
    }

    function handleRemove(product) {
        trackingService.trackEvent(EVENTS.CLICKED_REMOVE_FROM_WISHLIST, {
            productId: product.product_uid,
            productName: product.product_name,
            source: "profile_page",
        });
        removeFromWishlist(product.product_uid);
    }

    async function handleLogout() {
        trackingService.trackEvent(EVENTS.CLICKED_LOGOUT, { source: "profile_page" });

        await supabase.auth.signOut();

        try {
            clearWishlist?.();
            localStorage.removeItem("wishlist_products");
            localStorage.removeItem("roopsee_skin_profile");
            sessionStorage.removeItem("roopsee_matcher_history");
            sessionStorage.removeItem("quiz_submitted");
            sessionStorage.removeItem("quiz_login_popup_due_at");
            sessionStorage.removeItem("app_landing_tracked");
            sessionStorage.removeItem("roopsee-quiz-answers");
        } catch {
            // ignore
        }

        router.push("/");
    }

    return (
        <div className="min-h-screen bg-[#FAFAF8]">
            <div className="max-w-lg mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="Go back"
                        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <BiArrowBack size={18} />
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handleLogout}
                        aria-label="Logout"
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-1
                         text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <IoExitOutline size={15} />
                        Logout
                    </button>
                </div>

                {/* <h2 className="text-center text-[15px] font-bold uppercase tracking-[0.15em] text-gray-900 mb-5">
                    Your Profile
                </h2> */}

                <div className="flex flex-col items-center mb-5">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#f6a189] to-[#e8735c] flex items-center justify-center shadow-sm">
                        {avatarUrl ? (
                            <Image src={avatarUrl} alt="Profile photo" fill sizes="96px" className="object-cover" />
                        ) : (
                            <BiUser className="text-white" size={48} />
                        )}
                    </div>
                    <Link
                        href="/#matcher"
                        onClick={() => trackingService.trackEvent(EVENTS.CLICKED_EDIT_PROFILE, { source: "profile_page" })}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-1.5
                         text-[12px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <HiPencil size={13} />
                        Edit Details
                    </Link>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white mb-3">
                    <ProfileRow label="Login Method" value={loginMethod} isLast />
                </div>

                <div className="mb-6">
                    {googleLinked ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-[13px] font-semibold text-gray-700">
                            <FcGoogle size={16} />
                            Google account linked
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleLinkGoogle}
                            disabled={linkingGoogle}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:cursor-wait disabled:opacity-60"
                        >
                            <FcGoogle size={16} />
                            {linkingGoogle ? "Linking Google…" : "Link Google Account"}
                        </button>
                    )}
                    {linkGoogleError ? (
                        <p className="mt-2 text-center text-xs font-medium text-red-600" role="alert">{linkGoogleError}</p>
                    ) : null}
                </div>

                {profileLoaded && profile ? (
                    <>
                        <h2 className="text-center text-[12px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
                            Skin Profile
                        </h2>
                        <div className="rounded-2xl border border-gray-100 bg-white mb-6">
                            <ProfileRow label="skin type" value={profile.selectedSkinType || "—"} />
                            <ProfileRow
                                label="skin concern"
                                value={(profile.selectedFaceBodyConcerns || []).join(", ") || "—"}
                            />
                            <ProfileRow label="age" value={profile.age || "—"} />
                            <ProfileRow
                                label="special concerns"
                                value={(profile.selectedSpecialConditions || []).join(", ") || "None"}
                            />
                            <ProfileRow
                                label="skin sensitivity"
                                value={profile.selectedSensitive ? "Yes" : "No"}
                                isLast
                            />
                        </div>
                    </>
                ) : profileLoaded ? (
                    <div className="rounded-2xl bg-white border border-gray-100 px-6 py-8 text-center mb-6">
                        <p className="text-sm text-gray-500 mb-4">
                            You haven&apos;t taken the skin match quiz yet.
                        </p>
                        <Link
                            href="/#matcher"
                            className="inline-flex items-center justify-center rounded-full bg-gray-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-gray-800 transition-colors"
                        >
                            Take the quiz
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-2xl bg-white border border-gray-100 px-6 py-8 mb-6">
                        <div className="space-y-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                            ))}
                        </div>
                    </div>
                )}

                <h2 className="text-center text-[12px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-3">
                    Your Wishlist
                </h2>

                {!hydrated ? (
                    <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                                <div className="aspect-square bg-gray-100 animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : wishlistItems.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-gray-100 px-6 py-8 text-center">
                        <BiHeart className="mx-auto mb-3 text-rose-300" size={26} />
                        <p className="text-sm text-gray-500 mb-4">
                            Nothing saved yet — products you wishlist will appear here.
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center rounded-full bg-gray-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-gray-800 transition-colors"
                        >
                            Browse products
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {wishlistItems.map((product) => (
                            <WishlistCard
                                key={product.product_uid}
                                product={product}
                                onVisit={handleVisit}
                                onRemove={handleRemove}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
