'use client'

import { BiHeart } from 'react-icons/bi'
import { BsHeartFill } from 'react-icons/bs'
import { useWishlist } from '@/context/WishlistContext'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

// Same heart-toggle convention as the product cards elsewhere (Products.js,
// AllProducts) — top-left over the image, score badge keeps the top-right.
export default function RetailerProductWishlistButton({ product }) {
    const { isWishlisted, toggleWishlist } = useWishlist()
    const wishlisted = isWishlisted(product.product_uid)

    function handleClick(event) {
        event.preventDefault()
        event.stopPropagation()
        if (!toggleWishlist(product)) return

        const eventProps = {
            productId: product.product_uid,
            productName: product.product_name,
            brand: product.brand_name,
            price: product.selling_price || product.mrp,
            source: 'retailer_product_detail',
        }
        trackingService.trackEvent(
            wishlisted ? EVENTS.CLICKED_REMOVE_FROM_WISHLIST : EVENTS.CLICKED_ADD_TO_WISHLIST,
            eventProps,
        )
        trackingService.trackEvent(EVENTS.CLICKED_SAVE_MY_MATCH, eventProps)
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={wishlisted}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#d77465] shadow-sm transition hover:bg-white sm:left-3 sm:top-3"
        >
            {wishlisted ? <BsHeartFill size={16} /> : <BiHeart size={18} />}
        </button>
    )
}
