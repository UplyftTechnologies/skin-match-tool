// app/profile/page.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BiArrowBack, BiHeart } from "react-icons/bi";
import { HiPencil } from "react-icons/hi";
import { IoExitOutline } from "react-icons/io5";
import { supabase } from "@/lib/supabase/client";
import { useWishlist } from "@/context/WishlistContext";
import { getSavedSkinProfile } from "@/lib/profile-storage";
import ProductCard from "@/components/ProductCard";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

function ProfileRow({ label, value, isLast }) {
    return (
        <div className={`flex items-center justify-between py-4 ${!isLast ? "border-b border-gray-100" : ""}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {label}
            </span>
            <span className="text-[15px] font-semibold text-gray-900">
                {value}
            </span>
        </div>
    );
}

function ConcernPill({ label }) {
    return (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-[13px] font-semibold text-rose-600">
            {label}
        </span>
    );
}

export default function ProfilePage() {
    const router = useRouter();
    const { wishlistItems, hydrated, clearWishlist } = useWishlist();
    const [savedProfile, setSavedProfile] = useState(null);
    const [profileLoaded, setProfileLoaded] = useState(false);

    useEffect(() => {
        setSavedProfile(getSavedSkinProfile());
        setProfileLoaded(true);
    }, []);

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

    function handleVisit(product) {
        trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
            productId: product.product_uid,
            productName: product.product_name,
            section: "profile_wishlist",
        });
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
        } catch {
            // ignore
        }

        router.push("/");
    }

    return (
        <div className="min-h-screen bg-[#FAFAF8]">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-10">
                <div className="flex items-start justify-between">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="Go back"
                        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb- mt-2"
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


                {/* Skin profile card */}
                {profileLoaded && profile ? (
                    <div className="rounded-2xl mt-4 bg-white shadow-sm border border-gray-100 px-6 py-6 sm:px-7 sm:py-7">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl sm:text-[22px] font-bold text-gray-900" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                                Your Skin Profile
                            </h2>
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/#matcher"
                                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
                                    onClick={() =>
                                        trackingService.trackEvent(EVENTS.CLICKED_EDIT_PROFILE, {
                                            source: "profile_page",
                                        })
                                    }
                                >
                                    <HiPencil size={14} />
                                    Edit
                                </Link>


                            </div>
                        </div>

                        <div>
                            <ProfileRow label="Skin Type" value={profile.selectedSkinType || "—"} />
                            <div className="flex items-center justify-between py-4 border-b border-gray-100">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                    Concerns
                                </span>
                                <div className="flex flex-wrap gap-2 justify-end">
                                    {(profile.selectedFaceBodyConcerns || []).length
                                        ? profile.selectedFaceBodyConcerns.map((concern) => (
                                            <ConcernPill key={concern} label={concern} />
                                        ))
                                        : <span className="text-[15px] font-semibold text-gray-900">—</span>}
                                </div>
                            </div>
                            <ProfileRow
                                label="Conditions"
                                value={(profile.selectedSpecialConditions || []).join(", ") || "—"}
                            />
                            <ProfileRow label="Life Stage" value={profile.age || "—"} />
                            <ProfileRow
                                label="Sensitivity"
                                value={profile.selectedSensitive ? "Yes" : "No"}
                                isLast
                            />
                        </div>
                    </div>
                ) : profileLoaded ? (
                    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 px-6 py-10 text-center">
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
                    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 px-6 py-8">
                        <div className="h-6 w-40 bg-gray-100 rounded animate-pulse mb-6" />
                        <div className="space-y-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                            ))}
                        </div>
                    </div>
                )}

                {/* Wishlist section below the profile card */}
                <div className="mt-10 ">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-lg font-semibold text-gray-900">Your Wishlist</h2>
                        {hydrated && wishlistItems.length > 0 ? (
                            <span className="text-sm text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
                                {wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"}
                            </span>
                        ) : null}
                    </div>

                    {!hydrated ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                                    <div className="aspect-square bg-gray-100 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : wishlistItems.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-white border border-gray-100 px-6 py-8 text-center">
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5 mt-5">
                            {wishlistItems.map((product) => (
                                <ProductCard
                                    key={product.product_uid}
                                    product={product}
                                    onVisit={handleVisit}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
