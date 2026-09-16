'use client'

import Link from 'next/link'
import Image from 'next/image'
import { BsHeartFill } from 'react-icons/bs'
import Serum from '@/assets/images/serum.png'

// Shared by /profile and /wishlist — a plain Tailwind card instead of the
// legacy global-CSS-class ProductCard, which relies on styles that no
// longer render (unstyled heart icon, oversized score badge).
export default function WishlistProductCard({ product, onVisit, onRemove }) {
    const price = Number(product.selling_price || product.sp) > 0
        ? Number(product.selling_price || product.sp) : Number(product.mrp)
    const detailsUrl = product.details_url || `/retailer-products/${encodeURIComponent(product.retailer_product_id || product.product_uid)}`

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-3 flex flex-col items-center text-center">
            <div className="relative w-full">
                <button
                    type="button"
                    onClick={() => onRemove(product)}
                    aria-label="Remove from wishlist"
                    className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#d77465] shadow-sm transition hover:bg-white"
                >
                    <BsHeartFill size={14} />
                </button>
                <Link
                    href={detailsUrl}
                    onClick={() => onVisit?.(product)}
                    className="flex flex-col items-center w-full"
                >
                    <div className="relative w-full aspect-square mb-2">
                        <Image
                            src={product.image || product.image_url || Serum}
                            alt={product.product_name || 'Skincare product'}
                            fill
                            sizes="(max-width: 639px) 40vw, 25vw"
                            className="object-contain"
                        />
                    </div>
                    <p className="text-[12px] leading-snug text-gray-700 line-clamp-2">{product.product_name}</p>
                </Link>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[12px] font-semibold text-gray-900">
                    {price > 0 ? `₹${Math.ceil(price).toLocaleString('en-IN')}` : 'Price unavailable'}
                </span>
            </div>
        </div>
    )
}
