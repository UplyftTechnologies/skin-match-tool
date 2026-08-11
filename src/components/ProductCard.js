// components/ProductCard.js
"use client";

import { useState } from "react";
import Link from "next/link";
import { BiHeart } from "react-icons/bi";
import { BsHeartFill } from "react-icons/bs";
import { scoredProductPath } from "@/lib/site";
import { useWishlist } from "@/context/WishlistContext";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

function clampScore(score) {
  const value = Number(score) || 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function scoreBand(score) {
  if (score >= 80) return { label: "Great", className: "great" };
  if (score >= 60) return { label: "Caution", className: "caution" };
  return { label: "Poor", className: "poor" };
}

function scoreRange(score) {
  if (score >= 90) return "90_100";
  if (score >= 80) return "80_89";
  if (score >= 70) return "70_79";
  if (score >= 60) return "60_69";
  if (score >= 50) return "50_59";
  return "below50";
}

const SCORE_RANGE_COLORS = {
  "90_100": "#197A4D",
  "80_89": "#22c55e",
  "70_79": "#84cc16",
  "60_69": "#f97316",
  "50_59": "#f43f5e",
  below50: "#dc2626",
};

function scoreColor(score) {
  return SCORE_RANGE_COLORS[scoreRange(score)];
}

function rangeLabel(key) {
  return {
    "90_100": "90-100",
    "80_89": "80-89",
    "70_79": "70-79",
    "60_69": "60-69",
    "50_59": "50-59",
    below50: "Below 50",
  }[key] || "All";
}

function formatPrice(product) {
  const value = product.selling_price || product.mrp;
  return value ? `Rs. ${Math.ceil(value)}` : "Price unavailable";
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  if (!product.image || failed) return <div className="image-fallback">R</div>;
  return (
    <img
      alt={product.product_name}
      loading="lazy"
      onError={() => setFailed(true)}
      src={product.image}
    />
  );
}

export default function ProductCard({ product, onVisit }) {
  const displayScore = clampScore(product.score);
  const band = scoreBand(displayScore);
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.product_uid);

  function handleToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!toggleWishlist(product)) return;

    trackingService.trackEvent(
      wishlisted ? EVENTS.CLICKED_REMOVE_FROM_WISHLIST : EVENTS.CLICKED_ADD_TO_WISHLIST,
      {
        productId: product.product_uid,
        productName: product.product_name,
        brand: product.brand_name,
        price: product.selling_price || product.mrp,
        score: displayScore,
      }
    );
  }

  return (
    <div className="product-card-wrap relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute z-10 top-1 left-1 lg:top-2 lg:left-2"
      >
        {wishlisted ? (
          <BsHeartFill color="red" className="mt-1 mx-1" size={21} />
        ) : (
          <BiHeart className="text-black" size={28} />
        )}
      </button>

      <Link
        href={scoredProductPath(product.product_uid, product.score)}
        className="product-card"
        onClick={() => onVisit(product)}
      >
        <div className="product-image-wrap">
          <ProductImage product={product} />
          <div
            className={`score-badge score-${band.className}`}
            style={{ backgroundColor: scoreColor(displayScore) }}
          >
            <div>
              {displayScore}
              <small>{band.label}</small>
            </div>
          </div>
        </div>

        <div className="product-body">
          <div>
            <h3>{product.product_name}</h3>
            <p className="product-meta">
              {product.brand_name} · {product.category} · {product.product_type}
            </p>
          </div>

          <div className="price-row">
            <span>{formatPrice(product)}</span>
            {product.mrp &&
              product.selling_price &&
              product.mrp !== product.selling_price ? (
              <del>Rs. {Math.ceil(product.mrp)}</del>
            ) : null}
          </div>

          <div className="tagline">
            <span className="tag">{product.size || "Size unavailable"}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
