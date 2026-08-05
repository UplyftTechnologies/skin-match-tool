'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { FiSearch } from 'react-icons/fi'
import Serum from '@/assets/images/serum.png'
import OtpModal from '@/components/auth/otp-modal'
import { supabase } from '@/lib/supabase/client'
import { useWishlist } from '@/context/WishlistContext'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import { scoredProductPath } from '@/lib/site'
import { useScoredProducts } from '@/hooks/use-scored-products'
import ScoreBadge from '@/components/score-badge'

// ---------------------------------------------------------------------------
// Which scores show up in which row. One entry per row, top row first.
// `min` is inclusive, `max` is exclusive, so bands never overlap.
// `fallback` is optional: if the row can't be filled from its own range, the
// leftover slots are topped up from the fallback range instead.
// Change the numbers here to change the score preference — nothing else.
// ---------------------------------------------------------------------------
const SCORE_BANDS = [
    { min: 80, max: Infinity },  // row 1 — above 80
    { min: 60, max: 80 },        // row 2 — 60 to 80
    {
        min: -Infinity,
        max: 60,                          // row 3 — below 60
        fallback: { min: 60, max: 80 },   // ...topped up from 60-80 when short
    },
]

const PRODUCTS_PER_ROW = 2

// Last resort, only if a row is still short after its fallback. When true the
// remaining slots take the next best unused products, appended at the end of
// the grid. Set to false to leave the grid short instead.
const FILL_EMPTY_SLOTS = true

function productsInRange(products, { min, max }, used, count) {
    return products
        .filter((product) => {
            const score = Number(product.score)
            return score >= min && score < max && !used.has(product.product_uid)
        })
        .sort((a, b) => Number(b.score) - Number(a.score))
        .slice(0, count)
}

function pickByScoreBands(products) {
    const used = new Set()
    const picked = []

    for (const band of SCORE_BANDS) {
        const row = productsInRange(products, band, used, PRODUCTS_PER_ROW)
        for (const product of row) used.add(product.product_uid)

        if (band.fallback && row.length < PRODUCTS_PER_ROW) {
            const topUp = productsInRange(products, band.fallback, used, PRODUCTS_PER_ROW - row.length)
            for (const product of topUp) used.add(product.product_uid)
            row.push(...topUp)
        }

        picked.push(...row)
    }

    const wanted = SCORE_BANDS.length * PRODUCTS_PER_ROW
    if (FILL_EMPTY_SLOTS && picked.length < wanted) {
        const leftovers = products
            .filter((product) => !used.has(product.product_uid))
            .sort((a, b) => Number(b.score) - Number(a.score))

        picked.push(...leftovers.slice(0, wanted - picked.length))
    }

    return picked
}

function formatPrice(value) {
    const amount = Number(value)

    return Number.isFinite(amount)
        ? new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount)
        : null
}

function wishlistProduct(product) {
    return {
        ...product,
        image: product.image || '',
        brand_name: product.brand_name || 'Roopsee',
        category: product.category || 'Skincare',
        product_type: product.product_type || 'Product',
        size: product.size || 'Size unavailable',
    }
}

function ProductCard({ product }) {
    const { isWishlisted, toggleWishlist } = useWishlist()
    const router = useRouter()
    const [nameExpanded, setNameExpanded] = useState(false)
    const savedProduct = wishlistProduct(product)
    const wishlisted = isWishlisted(savedProduct.product_uid)
    const productHref = scoredProductPath(product.product_uid, product.score)
    const sellingPrice = formatPrice(product.selling_price)
    const mrp = formatPrice(product.mrp)
    const showMrp = mrp && Number(product.mrp) > Number(product.selling_price)

    function handleSaveMatch(event) {
        event.stopPropagation()
        toggleWishlist(savedProduct)
        trackingService.trackEvent(
            wishlisted ? EVENTS.CLICKED_REMOVE_FROM_WISHLIST : EVENTS.CLICKED_ADD_TO_WISHLIST,
            {
                productId: savedProduct.product_uid,
                productName: savedProduct.product_name,
                brand: savedProduct.brand_name,
                price: savedProduct.selling_price || savedProduct.mrp,
                source: 'home_products',
            },
        )
    }

    return (
        <div
            role="link"
            tabIndex={0}
            onClick={() => router.push(productHref)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    router.push(productHref)
                }
            }}
            className="bg-white rounded-lg p-3 flex flex-col cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#e08a7d] focus:ring-offset-2"
        >
            <div className="relative w-full aspect-[3/2] lg:aspect-[3/2] mb-3">
                <ScoreBadge score={product.score} />
                <Image
                    src={product.image || Serum}
                    alt={product.product_name || 'Skincare product'}
                    fill
                    sizes="(max-width: 639px) 50vw, 33vw"
                    className="object-contain"
                />
            </div>

            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                {product.brand_name}
            </p>
            <Link
                href={productHref}
                onClick={(event) => {
                    event.stopPropagation()
                    if (!nameExpanded) {
                        event.preventDefault()
                        setNameExpanded(true)
                    }
                }}
                aria-expanded={nameExpanded}
                title={nameExpanded ? undefined : 'Click to show full product name'}
                className={`mb-2 text-[12px] lg:text-sm font-lato text-gray-800 leading-snug transition hover:text-[#e08a7d] hover:underline ${
                    nameExpanded ? '' : 'line-clamp-2'
                }`}
            >
                {product.product_name}
            </Link>

            <div className="flex items-center gap-2 mb-3">
                {showMrp ? (
                    <span className="text-sm text-gray-400 line-through">{mrp}</span>
                ) : null}
                <span className="text-sm font-semibold text-gray-900">
                    {sellingPrice || mrp || 'Price unavailable'}
                </span>
            </div>

            <button
                type="button"
                onClick={handleSaveMatch}
                style={{ fontSize: '11px' }}
                aria-pressed={wishlisted}
                className={`mt-auto w-[90%] mx-auto font-semibold border rounded-full py-[8px] transition-colors duration-200 ${
                    wishlisted
                        ? 'bg-[#e08a7d] border-[#e08a7d] text-white'
                        : 'text-[#e08a7d] border-[#e08a7d] hover:bg-[#e08a7d] hover:text-white'
                }`}
            >
                {wishlisted ? 'Saved to wishlist' : 'Save my match'}
            </button>
        </div>
    )
}


export const REQUEST_LOGIN_EVENT = 'roopsee-request-login'

export default function Products() {
    const [search, setSearch] = useState('')
    const [isLoginOpen, setIsLoginOpen] = useState(false)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const { products, loading, error, quizAnswers } = useScoredProducts()
    const router = useRouter()

    const handleViewAll = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
            router.push('/AllProducts')
            return
        }

        setIsLoginOpen(true)
    }

    useEffect(() => {
        let isMounted = true

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (isMounted) setIsAuthenticated(Boolean(session))
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(Boolean(session))
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    useEffect(() => {
        const showLoginForGuest = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) setIsLoginOpen(true)
        }

        window.addEventListener(REQUEST_LOGIN_EVENT, showLoginForGuest)
        return () => window.removeEventListener(REQUEST_LOGIN_EVENT, showLoginForGuest)
    }, [])


    const visibleProducts = useMemo(() => {
        const query = search.trim().toLowerCase()
        const filtered = query
            ? products.filter((product) =>
                [product.product_name, product.brand_name, product.category, product.product_type]
                    .some((value) => value?.toLowerCase().includes(query)),
            )
            : products

        const withScore = filtered.filter((product) => Number.isFinite(Number(product.score)))

        return pickByScoreBands(withScore)
    }, [products, search])

    // Nothing to show until the quiz has actually been completed.
    if (!quizAnswers) {
        return null
    }

    return (
        <div id="products" className="scroll-mt-20 bg-[#FAF9F6]">
            <div className="max-w-6xl lg:max-w-[80%] mx-auto px-3 py-6">
                          <h2 style={{ letterSpacing: '0.1em' }} className="font-lato text-lg uppercase md:text-3xl text-center tracking- mb-1">

                    Products
                </h2>

                <div className="mx-auto mt-3 max-w-3xl rounded-2xl border border-[#ead8d3] bg-white px-4 py-3">
                    <p className="text-center text-[11px] font-bold uppercase tracking-widest text-[#d77465]">
                        Your selections
                    </p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                        {[
                            ['Skin', quizAnswers.skinType],
                            ['Sensitive', quizAnswers.sensitive],
                            ...(
                                Array.isArray(quizAnswers.concerns)
                                    ? quizAnswers.concerns
                                    : quizAnswers.concern
                                        ? [quizAnswers.concern]
                                        : []
                            ).map((concern) => ['Concern', concern]),
                            ['Age', quizAnswers.age],
                            ['Gender', quizAnswers.gender],
                            ...(quizAnswers.conditions || []).map((condition) => ['Condition', condition]),
                        ].filter(([, value]) => value).map(([label, value], index) => (
                            <span
                                key={`${label}-${value}-${index}`}
                                className="rounded-full bg-[#f8eeeb] px-3 py-1 text-xs font-medium text-slate-700"
                            >
                                <strong>{label}:</strong> {value}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="relative max-w-xl mx-auto mb-2 mt-3 lg:mt-4">
                    <FiSearch
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#e08a7d]"
                        size={18}
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search products or brands"
                        className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#e08a7d] shadow-sm"
                    />
                </div>

                {loading ? (
                    <p className="py-8 text-center text-sm text-gray-500">Loading products…</p>
                ) : null}
                {error ? (
                    <p className="py-8 text-center text-sm text-red-600">{error}</p>
                ) : null}
                {!loading && !error && visibleProducts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No products found.</p>
                ) : null}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 lg:mt-5 md:gap-6">
                    {visibleProducts.map((product) => (
                        <ProductCard key={product.product_uid} product={product} />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={handleViewAll}
                    className="block w-full lg:w-[70%] font-lato mt-5 mx-auto text-sm tracking-widest
                     capitalize text-[#ff7e67] border border-[#e08a7d] rounded-[10px] py-2
                      hover:bg-[#d17a6d] hover:text-white transition-colors duration-300"
                >
                    {isAuthenticated ? 'View all' : 'Login to View all'}
                </button>
            </div>

            <OtpModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                onSuccess={() => {
                    setIsLoginOpen(false)
                    router.push('/AllProducts')
                }}
            />
        </div>
    )
}
