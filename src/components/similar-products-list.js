/* eslint-disable @next/next/no-img-element */
'use client'

import { useState } from "react";
import Link from "next/link";
import { useScoredProducts } from "@/hooks/use-scored-products";
import { scoredProductPath } from "@/lib/site";
import SaveProductButton from "@/components/save-product-button";
import ScoreBadge from "@/components/score-badge";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

function formatPrice(value) {
  const number = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? `Rs. ${Math.ceil(number)}` : null;
}

function SimilarProductCard({ product, score }) {
  const [imageFailed, setImageFailed] = useState(false);
  const price = formatPrice(product.sp || product.mrp);
  const wishlistProduct = {
    product_uid: product.product_uid,
    product_name: product.product_name,
    brand_name: product.brand_name,
    category: product.category,
    product_type: product.product_type,
    image: product.image,
    selling_price: product.sp,
    mrp: product.mrp,
    size: product.sku_size,
    when_to_use: product.when_to_use,
  };

  return (
    <div className="relative w-[150px] shrink-0 snap-start sm:w-[180px]">
      <SaveProductButton
        product={wishlistProduct}
        label=""
        className="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#d77465] shadow-sm transition hover:bg-white"
      />
      <Link
        className="block h-full rounded-2xl border border-slate-100 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e08a7d]"
        href={scoredProductPath(product.product_uid, score)}
        onClick={() =>
          trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
            productId: product.product_uid,
            productName: product.product_name,
            brand: product.brand_name,
            price: product.sp || product.mrp,
            score,
            section: "similar_products",
          })
        }
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50">
          {Number.isFinite(score) ? <ScoreBadge score={score} /> : null}
          {product.image && !imageFailed ? (
            <img
              alt={product.product_name}
              className="h-full w-full object-contain"
              onError={() => setImageFailed(true)}
              src={product.image}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-extrabold text-[#f3a99a]">
              R
            </div>
          )}
        </div>
        <p className="mt-2 truncate text-[10px] font-extrabold uppercase tracking-wide text-[#e08a7d]">
          {product.brand_name || "Roopsee"}
        </p>
        <p className="mt-0.5 line-clamp-2 min-h-[2.4em] text-[12.5px] font-semibold leading-snug text-slate-800">
          {product.product_name}
        </p>
        <p className="mt-1.5 text-[13px] font-bold text-slate-900">
          {price || "Price not listed"}
        </p>
      </Link>
    </div>
  );
}

export default function SimilarProductsList({ products }) {
  const { products: scoredProducts } = useScoredProducts();
  const scoreByUid = new Map(scoredProducts.map((item) => [item.product_uid, item.score]));

  return (
    <div className="mt-3 -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
      {products.map((item) => (
        <SimilarProductCard
          key={item.product_uid}
          product={item}
          score={scoreByUid.get(item.product_uid)}
        />
      ))}
    </div>
  );
}
