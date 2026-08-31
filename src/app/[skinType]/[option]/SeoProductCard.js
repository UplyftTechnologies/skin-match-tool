/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";
import { productPath } from "@/lib/site";
import { clampScore, getScoreBand } from "@/lib/score-band";

export default function SeoProductCard({ product, section }) {
  const price = product.mrp;
  const displayScore = clampScore(product.score);
  const band = getScoreBand(displayScore);

  function trackVisit() {
    trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
      productId: product.product_uid,
      productName: product.product_name,
      brand: product.brand_name,
      price,
      score: product.score,
      section,
    });
  }

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {product.image ? <img alt={product.product_name} loading="lazy" src={product.image} /> : <div className="image-fallback">R</div>}
        <div className={`score-badge score-${band.key}`} style={{ backgroundColor: band.fill }}>
          <div>{displayScore}<small>{band.label}</small></div>
        </div>
      </div>
      <div className="product-body">
        <div><h3>{product.product_name}</h3><p className="product-meta">{product.brand_name} · {product.category} · {product.product_type}</p></div>
        <div className="price-row"><span>{price ? `Rs. ${Math.ceil(price)}` : "Price unavailable"}</span></div>
        <p className="product-copy">{product.match_label}. {product.hero_ingredient || "See the product page for ingredient information."}</p>
        <Link className="details-link" href={productPath(product.product_uid)} onClick={trackVisit}>View product details</Link>
      </div>
    </article>
  );
}
