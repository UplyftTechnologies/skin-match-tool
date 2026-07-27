// components/ProductCard.js
"use client";

import { useState } from "react";
import Link from "next/link";
import { BiHeart } from "react-icons/bi";
import { BsHeartFill } from "react-icons/bs";
import { productPath } from "@/lib/site";
import { useWishlist } from "@/context/WishlistContext";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

function scoreBand(score) {
    if (score >= 80) return { label: "Good", className: "good" };
    if (score >= 60) return { label: "Present", className: "present" };
    return { label: "Weak", className: "weak" };
}

function scoreRange(score) {
    if (score >= 90) return "90_100";
    if (score >= 80) return "80_89";
    if (score >= 70) return "70_79";
    if (score >= 60) return "60_69";
    if (score >= 50) return "50_59";
    return "below50";
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
    return value ? `Rs. ${value}` : "Price unavailable";
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
    const band = scoreBand(product.score);
    const { isWishlisted, toggleWishlist } = useWishlist();
    const wishlisted = isWishlisted(product.product_uid);

    function handleToggle(event) {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(product);

        trackingService.trackEvent(
            wishlisted ? EVENTS.CLICKED_REMOVE_FROM_WISHLIST : EVENTS.CLICKED_ADD_TO_WISHLIST,
            {
                productId: product.product_uid,
                productName: product.product_name,
                brand: product.brand_name,
                price: product.selling_price || product.mrp,
                score: product.score,
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
                    <BsHeartFill color="red" size={26} />
                ) : (
                    <BiHeart className="text-black" size={28} />
                )}
            </button>

            <Link
                href={productPath(product.product_uid)}
                className="product-card"
                onClick={() => onVisit(product)}
            >
                <div className="product-image-wrap">
                    <ProductImage product={product} />
                    <div className={`score-badge score-${band.className}`}>
                        <div>
                            {product.score}
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
                            <del>Rs. {product.mrp}</del>
                        ) : null}
                    </div>

                    <div className="tagline">
                        {/* <span className="tag">{rangeLabel(scoreRange(product.score))}</span> */}
                        {/* <span className="tag">{product.when_to_use || "Routine"}</span> */}
                        <span className="tag">{product.size || "Size unavailable"}</span>
                    </div>

                    <span className="details-link">View product details</span>
                </div>
            </Link>
        </div>
    );
}