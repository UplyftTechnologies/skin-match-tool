"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BiHeart, BiArrowBack } from "react-icons/bi";
import { useWishlist } from "@/context/WishlistContext";
import ProductCard from "@/components/ProductCard";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export default function WishlistPage() {
  const router = useRouter();
  const { wishlistItems, hydrated } = useWishlist();

  useEffect(() => {
    if (!hydrated) return;
    trackingService.trackPageLoad(EVENTS.PAGE_VIEWED_WISHLIST, {
      page_type: "wishlist",
      item_count: wishlistItems.length,
    });
  }, [hydrated]);
  
  function handleVisit(product) {
    trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
      productId: product.product_uid,
      productName: product.product_name,
      brand: product.brand_name,
      price: product.selling_price || product.mrp,
      section: "wishlist_page",
    });
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                <div className="aspect-square bg-gray-100 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 w-3/4 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <BiArrowBack size={18} />
            Back
          </button>
        </div>

        <div className="flex items-center justify-center px-4 py-20">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
              <BiHeart className="text-rose-400" size={30} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Your wishlist is empty
            </h1>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Products you save will show up here so you can come back to them anytime.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Browse products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-5"
        >
          <BiArrowBack size={18} />
          Back
        </button>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
            Wishlist
          </h1>
          <span className="text-sm text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
            {wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-8">
          Products you&apos;ve saved for later.
        </p>

        <div className="wishlist-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {wishlistItems.map((product) => (
            <ProductCard
              key={product.product_uid}
              product={product}
              onVisit={handleVisit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
