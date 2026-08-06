// components/save-product-button.js
"use client";

import { BsHeartFill } from "react-icons/bs";
import { BiHeart } from "react-icons/bi";
import { useWishlist } from "@/context/WishlistContext";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export default function SaveProductButton({ product, className, mobile = false }) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.product_uid);

  function handleClick() {
    if (!toggleWishlist(product)) return;
    trackingService.trackEvent(
      wishlisted ? EVENTS.CLICKED_REMOVE_FROM_WISHLIST : EVENTS.CLICKED_ADD_TO_WISHLIST,
      {
        productId: product.product_uid,
        productName: product.product_name,
        brand: product.brand_name,
        price: product.selling_price || product.mrp,
        source: "product_details_page",
      }
    );
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {wishlisted ? (
        <BsHeartFill size={mobile ? 16 : 18} />
      ) : (
        <BiHeart size={mobile ? 18 : 20} />
      )}
      {wishlisted ? "Saved to Wishlist" : "Save Product"}
    </button>
  );
}
