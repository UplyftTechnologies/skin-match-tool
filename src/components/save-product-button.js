// components/save-product-button.js
"use client";

import { BsHeartFill } from "react-icons/bs";
import { BiHeart } from "react-icons/bi";
import { useWishlist } from "@/context/WishlistContext";
import { trackingService } from "@/lib/tracking/trackingClient";
import { EVENTS } from "@/lib/tracking/events";

export default function SaveProductButton({
  product,
  className,
  savedClassName,
  unsavedClassName,
  mobile = false,
  label = "Save Product",
}) {
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

  // Callers that only pass `className` keep a single fixed look; passing
  // saved/unsaved variants opts into a button that fills in once wishlisted.
  const variantClassName = wishlisted ? savedClassName : unsavedClassName;

  return (
    <button type="button" onClick={handleClick} className={variantClassName ?? className}>
      {wishlisted ? (
        <BsHeartFill size={mobile ? 16 : 18} />
      ) : (
        <BiHeart size={mobile ? 18 : 20} />
      )}
      {wishlisted ? "Saved to Wishlist" : label}
    </button>
  );
}
