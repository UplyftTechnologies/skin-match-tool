'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { BsHeartFill } from 'react-icons/bs'
import { BiHeart } from 'react-icons/bi'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode, Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import 'swiper/css/navigation'
import { useWishlist } from '@/context/WishlistContext'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import { useRetailerCatalog } from '@/hooks/use-retailer-catalog'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import { quizAnswersToScoringProfile } from '@/lib/quiz-profile'
import ScoreBadge from '@/components/score-badge'
import VisualSearch from '@/components/visual-search'


const SCORE_BANDS = [
    { min: 80, max: Infinity },  // row 1 — above 80
    { min: 60, max: 80 },        // row 2 — 60 to 80
    {
        min: -Infinity,
        max: 60,                          // row 3 — below 60
        fallback: { min: 60, max: 80 },   // ...topped up from 60-80 when short
    },
]

const PRODUCTS_PER_ROW = 3
const SECTION_SLIDE_COUNT = 12

const DISPLAY_SCORE_BANDS = [
    { min: 90, max: Infinity, count: SECTION_SLIDE_COUNT },
    { min: 50, max: 90, count: SECTION_SLIDE_COUNT },
    { min: -Infinity, max: 50, count: SECTION_SLIDE_COUNT },
].slice(0, SCORE_BANDS.length)

const PRODUCT_SCORE_SECTIONS = [
    { title: 'Your Great Match', subtitle: '90+ score', min: 90, max: Infinity, color: '#4f8060', line: '#bfd8c7', badge: '#edf7f0' },
    { title: 'Fits With Caution', subtitle: '50–89 score', min: 50, max: 90, color: '#906c25', line: '#e6d2a8', badge: '#fff8e8' },
    { title: 'Not Recommended', subtitle: 'Below 50 score', min: -Infinity, max: 50, color: '#a6534b', line: '#e8c3bf', badge: '#fff0ee' },
]

const FILL_EMPTY_SLOTS = false

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

    for (const band of DISPLAY_SCORE_BANDS) {
        const bandCount = band.count || PRODUCTS_PER_ROW
        const row = productsInRange(products, band, used, bandCount)
        for (const product of row) used.add(product.product_uid)

        if (band.fallback && row.length < bandCount) {
            const topUp = productsInRange(products, band.fallback, used, bandCount - row.length)
            for (const product of topUp) used.add(product.product_uid)
            row.push(...topUp)
        }

        picked.push(...row)
    }

    const wanted = DISPLAY_SCORE_BANDS.length * PRODUCTS_PER_ROW
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
        }).format(Math.ceil(amount))
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
    const [imageFailed, setImageFailed] = useState(false)
    const savedProduct = wishlistProduct(product)
    const wishlisted = isWishlisted(savedProduct.product_uid)
    const productHref = `/retailer-products/${encodeURIComponent(product.product_uid)}`
    const mrp = formatPrice(product.mrp)

    function handleSaveMatch(event) {
        event.stopPropagation()
        if (!toggleWishlist(savedProduct)) return
        const eventProps = {
            productId: savedProduct.product_uid,
            productName: savedProduct.product_name,
            brand: savedProduct.brand_name,
            price: savedProduct.selling_price || savedProduct.mrp,
            source: 'home_products',
        }
        trackingService.trackEvent(
            wishlisted ? EVENTS.CLICKED_REMOVE_FROM_WISHLIST : EVENTS.CLICKED_ADD_TO_WISHLIST,
            eventProps,
        )
        trackingService.trackEvent(EVENTS.CLICKED_SAVE_MY_MATCH, eventProps)
    }

    function trackVisit() {
        trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
            productId: savedProduct.product_uid,
            productName: savedProduct.product_name,
            brand: savedProduct.brand_name,
            price: savedProduct.selling_price || savedProduct.mrp,
            score: product.score,
            section: 'home_products',
        })
    }

    function handleVisit() {
        trackVisit()
        router.push(productHref)
    }

    function handleBuyNow(event) {
        event.stopPropagation()
        handleVisit()
    }

    return (
        <div
            role="link"
            tabIndex={0}
            onClick={handleVisit}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleVisit()
                }
            }}
            className="h-full bg-white rounded-lg p-3 flex flex-col cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#e08a7d] focus:ring-offset-2"
        >
            <div className="relative w-full aspect-[3/2] lg:aspect-[3/2] mb-3">
                <ScoreBadge score={product.score} />
                <button
                    type="button"
                    onClick={handleSaveMatch}
                    aria-pressed={wishlisted}
                    aria-label={wishlisted ? 'Remove from wishlist' : 'Save my match'}
                    className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#d77465] shadow-sm transition hover:bg-white"
                >
                    {wishlisted ? <BsHeartFill size={16} /> : <BiHeart size={18} />}
                </button>
                {imageFailed || !product.image ? (
                    <div className="image-fallback">R</div>
                ) : (
                    <Image
                        src={product.image}
                        alt={product.product_name || 'Skincare product'}
                        fill
                        sizes="(max-width: 639px) 50vw, 33vw"
                        className="object-contain"
                        onError={() => setImageFailed(true)}
                    />
                )}
            </div>

            <p className="mb-1 min-h-4 truncate text-xs uppercase tracking-wide text-gray-400">
                {product.brand_name}
            </p>
            <Link
                href={productHref}
                onClick={(event) => {
                    event.stopPropagation()
                    trackVisit()
                }}
                title={product.product_name}
                className="product-name-clamp mb-2 min-h-[2.5rem] text-[12px] font-lato leading-snug text-gray-800 transition hover:text-[#e08a7d] hover:underline lg:text-sm"
            >
                {product.product_name}
            </Link>

            <div className="mb-3 flex min-h-5 items-center gap-2">
                <span className="truncate text-sm font-semibold text-gray-900">
                    {mrp || 'Price unavailable'}
                </span>
            </div>

            <button
                type="button"
                onClick={handleBuyNow}
                style={{ fontSize: '11px' }}
                className="mt-auto w-[90%] mx-auto font-semibold border rounded-full py-[8px] transition-colors duration-200 text-white bg-[#e08a7d] border-[#e08a7d] hover:bg-[#d17a6d]"
            >
                View Products
            </button>
        </div>
    )
}


export default function Products() {
    const [activeView, setActiveView] = useState('products')
    const [search, setSearch] = useState('')
    const quizAnswers = useQuizAnswers()
    // Must go through quizAnswersToScoringProfile, not be assembled by hand:
    // the quiz stores raw widget answers (concern "redness", sensitive "no",
    // condition "excessive dryness") while the engine keys on its own column
    // names ("Redness/Irritation", boolean, "Excessive Dryness"). Hand-building
    // it sent an unmatchable concern, which scored every product at the
    // missing-value default and kept the 90+ band permanently empty.
    const profile = quizAnswers ? quizAnswersToScoringProfile(quizAnswers) : null
    const { products: catalogProducts, loading, error } = useRetailerCatalog({
        search: '',
        filters: { brand: [], category: [], site: [], price: [] },
        sort: 'score_desc',
        page: 1,
        profile,
        // One row per score band. A plain page-one fetch returns only the
        // highest scores, which left the 'Fits With Caution' and 'Not
        // Recommended' rows permanently empty.
        bands: PRODUCTS_PER_ROW,
    })
    const products = catalogProducts.map((product) => ({
        ...product,
        score: product.scoring?.score,
        size: product.sku_size,
    }))
    const router = useRouter()

    const handleViewAll = () => {
        trackingService.trackEvent(EVENTS.CLICKED_VIEW_ALL_PRODUCTS, {
            source: 'home_products',
            view: activeView,
        })

        router.push('/AllProducts')
    }

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
    // Ported from the design branch during the merge. Declared before the
    // early return below, because a hook cannot run conditionally.
    useEffect(() => {
        const term = search.trim()
        if (!term) return undefined

        const debounceTimer = window.setTimeout(() => {
            trackingService.trackEvent(EVENTS.SEARCH_PERFORMED, {
                value: term,
                query: term,
                results_count: visibleProducts.length,
                source: 'home_products_search',
            })
        }, 800)

        return () => window.clearTimeout(debounceTimer)
    }, [search, visibleProducts.length])

    if (!quizAnswers) {
        return null
    }

    return (
        <div id="products" className="scroll-mt-20 bg-[#FAF9F6]">
            <div className="max-w-6xl lg:max-w-[80%] mx-auto px-3 py-6">
                <div
                    role="tablist"
                    aria-label="Recommendations view"
                    className="flex items-center justify-center gap-7 font-lato text-lg uppercase tracking-[0.16em] md:gap-12 md:text-3xl"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeView === 'products'}
                        onClick={() => setActiveView('products')}
                        className={`transition-colors ${activeView === 'products' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Products
                    </button>
               
                </div>

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

                {activeView === 'products' ? <div className="relative max-w-xl mx-auto mb-2 mt-3 lg:mt-4">
                    <FiSearch
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#e08a7d]"
                        size={18}
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search products or brands"
                        className="w-full pl-11 pr-12 py-3 rounded-full border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#e08a7d] shadow-sm"
                    />
                    <VisualSearch onQuery={setSearch} />
                </div> : null}

                {loading ? (
                    <p className="py-8 text-center text-sm text-gray-500">Loading products…</p>
                ) : null}
                {error ? (
                    <p className="py-8 text-center text-sm text-red-600">{error}</p>
                ) : null}
                {!loading && !error && activeView === 'products' && visibleProducts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No products found.</p>
                ) : null}

                {activeView === 'products' ? (
                    <div className="mt-4 space-y-7 lg:mt-6">
                        {PRODUCT_SCORE_SECTIONS.map((section) => {
                            const sectionProducts = visibleProducts.filter((product) => {
                                const score = Number(product.score)
                                return score >= section.min && score < section.max
                            })

                            if (sectionProducts.length === 0) return null

                            return (
                                <section key={section.title}>
                                    <div className="mb-3 flex flex-col items-center text-center">
                                        <div className="flex w-full items-center gap-3">
                                            <span className="h-px flex-1" style={{ backgroundColor: section.line }} />
                                            <h3
                                                className="shrink-0 font-cormorant text-[20px] font-semibold italic tracking-wide md:text-2xl"
                                                style={{ color: section.color }}
                                            >
                                                {section.title}
                                            </h3>
                                            <span className="h-px flex-1" style={{ backgroundColor: section.line }} />
                                        </div>
                                        <span
                                            className="mt-1.5 rounded-full px-3 py-1 font-lato text-[9px] font-semibold uppercase tracking-[0.14em] md:text-[10px]"
                                            style={{ backgroundColor: section.badge, color: section.color }}
                                        >
                                            {section.subtitle}
                                        </span>
                                    </div>
                                    <Swiper
                                        modules={[FreeMode, Navigation]}
                                        slidesPerView={2.2}
                                        spaceBetween={12}
                                        freeMode={true}
                                        navigation={sectionProducts.length > 1 ? {
                                            prevEl: '.product-slider-prev',
                                            nextEl: '.product-slider-next',
                                            disabledClass: 'product-slider-nav-disabled',
                                        } : false}
                                        className="product-slider"
                                        breakpoints={{
                                            640: { slidesPerView: 3.2, spaceBetween: 16 },
                                            1024: { slidesPerView: 4.2, spaceBetween: 20 },
                                        }}
                                    >
                                        {sectionProducts.map((product) => (
                                            <SwiperSlide key={product.product_uid} className="!h-auto">
                                                <ProductCard product={product} />
                                            </SwiperSlide>
                                        ))}
                                        {sectionProducts.length > 1 ? (
                                            <>
                                                <button
                                                    type="button"
                                                    aria-label="Previous products"
                                                    className="product-slider-prev product-slider-nav"
                                                    style={{ color: section.color }}
                                                >
                                                    <FiChevronLeft size={18} />
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label="Next products"
                                                    className="product-slider-next product-slider-nav"
                                                    style={{ color: section.color }}
                                                >
                                                    <FiChevronRight size={18} />
                                                </button>
                                            </>
                                        ) : null}
                                    </Swiper>
                                </section>
                            )
                        })}
                    </div>
                ) : (
                    <div className="mx-auto mt-5 max-w-4xl space-y-6">
                        {['cleanser', 'moisturiser'].map((slot) => {
                            const valueFitItem = [
                                ...(routine?.tiers?.value_fit?.am || []),
                                ...(routine?.tiers?.value_fit?.pm || []),
                            ].find((item) => item.slot === slot && item.product)
                            const premiumItem = [
                                ...(routine?.tiers?.premium?.am || []),
                                ...(routine?.tiers?.premium?.pm || []),
                            ].find((item) => item.slot === slot && item.product)
                            const label = slot === 'moisturiser' ? 'Moisturiser' : 'Cleanser'

                            return (
                                <section key={slot}>
                                    <h3 className="mb-2 text-center font-lato text-sm text-slate-700">
                                        {label}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2 md:gap-6">
                                        {[
                                            ['Value Fit', valueFitItem],
                                            ['Premium', premiumItem],
                                        ].map(([tierLabel, item]) => (
                                            <div key={tierLabel} className="flex min-w-0 flex-col">
                                                <p className={`mx-auto mb-3 rounded-full border px-4 py-1.5 text-center font-lato text-[11px] font-semibold uppercase tracking-[0.14em] shadow-sm md:text-xs ${
                                                    tierLabel === 'Premium'
                                                        ? 'border-[#e7c8a0] bg-[#fff8ed] text-[#9a6428]'
                                                        : 'border-[#c9dedc] bg-[#eef7f6] text-[#426d69]'
                                                }`}>
                                                    {tierLabel}
                                                </p>
                                                {item?.product ? (
                                                    <ProductCard product={item.product} />
                                                ) : (
                                                    <div className="flex min-h-52 items-center justify-center rounded-lg bg-white p-4 text-center text-xs text-gray-400">
                                                        No {tierLabel.toLowerCase()} match found
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )
                        })}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleViewAll}
                    className="block w-full lg:w-[70%] font-lato mt-5 mx-auto text-sm tracking-widest
                     capitalize text-[#ff7e67] border border-[#e08a7d] rounded-[10px] py-2
                      hover:bg-[#d17a6d] hover:text-white transition-colors duration-300"
                >
                    View all
                </button>
            </div>
        </div>
    )
}
