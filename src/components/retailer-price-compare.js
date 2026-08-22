'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FiChevronUp, FiExternalLink, FiStar, FiTag, FiThumbsUp, FiX } from 'react-icons/fi'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import Amazon from '@/assets/images/amazon.png'
import Tira from '@/assets/images/tiira.png'
import Nyka from '@/assets/images/nyka.webp'
import Image from 'next/image'


const SITE_LOGOS = { nykaa: Nyka, tira: Tira, amazon: Amazon }
const SITE_NAMES = { nykaa: 'Nykaa', tira: 'Tira', amazon: 'Amazon', roopsee: 'Roopsee' }

function siteName(site) {
    return SITE_NAMES[site] || site
}

function roopseeStoreUrl(productUid) {
    return `https://shop.roopsee.com/products/${encodeURIComponent(productUid)}`
}

function RetailerLogo({ site, height = 18, className = '' }) {
    if (site === 'roopsee') {
        return (
            <span
                className={`font-semibold text-black ${className}`}
                style={{ fontSize: height * 0.62, letterSpacing: '-0.02em' }}
            >
                roopsee<span style={{ color: '#ff00e6' }}>.</span>
            </span>
        )
    }
    const logo = SITE_LOGOS[site]
    if (!logo) {
        return <span className={`font-bold ${className}`}>{siteName(site)}</span>
    }
    return (
        <Image
            src={logo}
            alt={siteName(site)}
            height={height}
            width={height * 3}
            style={{ height, width: 'auto' }}
            className={`object-contain ${className}`}
        />
    )
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

function formatApproxPrice(value) {
    const rounded = Math.ceil(Number(value))
    return Number.isFinite(rounded) ? `~${formatPrice(rounded)}` : null
}

function Rating({ offer }) {
    if (!offer.rating) return null
    return (
        <span className="inline-flex items-center gap-1 text-[12px] text-slate-500">
            <FiStar aria-hidden="true" className="h-3 w-3 fill-amber-400 text-amber-400" />
            {Number(offer.rating).toFixed(1)}
            {offer.rating_count ? (
                <span className="text-slate-400">({offer.rating_count.toLocaleString('en-IN')})</span>
            ) : null}
        </span>
    )
}

function BuyButton({ offer, productName, primary, compact }) {
    function handleBuy() {
        trackingService.trackEvent(EVENTS.CLICKED_BUY_FROM_RETAILER, {
            site: offer.site,
            retailer: siteName(offer.site),
            productName,
            retailerProductName: offer.product_name,
            price: offer.price,
            source: compact ? 'compare_row' : 'offer_modal',
        })
    }

    // Compact pill sits inline on a comparison row, so it stays out of the way
    // of the row's own job of opening the detail modal.
    if (compact) {
        return (
            <a
                href={offer.product_url}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                onClick={handleBuy}
                aria-label={`Buy ${offer.product_name} from ${siteName(offer.site)}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e08a7d] px-3 py-1.5 text-[12px] font-semibold text-[#d77465] transition-colors hover:bg-[#e08a7d] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e08a7d] sm:px-3.5 sm:py-2"
            >
                Buy now
            </a>
        )
    }

    return (
        <a
            href={offer.product_url}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            onClick={handleBuy}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold tracking-wide transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e08a7d] ${
                primary
                    ? 'bg-[#f3a99a] text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#e08a7d]'
                    : 'border border-[#e08a7d] text-[#d77465] hover:bg-[#e08a7d] hover:text-white'
            }`}
        >
            Buy from {siteName(offer.site)}
            <span className="font-bold">{formatPrice(offer.price)}</span>
            <FiExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
    )
}

function OfferModal({ offer, offers, productName, onClose }) {
    const closeRef = useRef(null)

    useEffect(() => {
        closeRef.current?.focus()
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKeyDown)
        const { overflow } = document.body.style
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = overflow
        }
    }, [onClose])

    const mrp = Number(offer.mrp)
    const showMrp = Number.isFinite(mrp) && mrp > offer.price
    // Retailers mix two very different shapes under key_features/key_ingredients:
    // short tags ("Hydrating") and, on Amazon in particular, full bullet
    // paragraphs ("REDUCES ACNE & BLACKHEADS - ..."). A paragraph inside a
    // rounded-full pill renders as an oversized stadium shape, so long items
    // get their own bullet list instead of the tag row.
    const rawFeatures = [...(offer.key_ingredients || []), ...(offer.key_features || [])].filter(Boolean)
    const tagFeatures = rawFeatures.filter((item) => item.length <= 40).slice(0, 6)
    const bulletFeatures = rawFeatures.filter((item) => item.length > 40).slice(0, 6)

    // Amazon rows commonly duplicate the bullet paragraphs verbatim inside
    // `description` (joined with newlines, which collapse in HTML into one
    // run-on wall of text) — skip it rather than repeat the bullets above.
    const normalizedDescription = (offer.description || '').replace(/\s+/g, ' ').trim()
    const normalizedBullets = bulletFeatures.map((item) => item.replace(/\s+/g, ' ').trim()).join(' ')
    const descriptionDuplicatesBullets = bulletFeatures.length > 0 && normalizedDescription === normalizedBullets

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 
            p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`${offer.product_name} on ${siteName(offer.site)}`}
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-7"
            >
                <div className="flex items-start justify-between gap-4">
                    <span className="flex items-center rounded-full bg-rose-50 px-3 py-1.5">
                        <RetailerLogo site={offer.site} height={14} />
                    </span>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e08a7d]"
                    >
                        <FiX aria-hidden="true" className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
                    <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-100 bg-white p-3">
                        {offer.image_url ? (
                            <img
                                alt={offer.product_name}
                                src={offer.image_url}
                                className="h-full w-full object-contain"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl font-extrabold text-[#f3a99a]">
                                R
                            </div>
                        )}
                    </div>

                    <div className="min-w-0">
                        <h3 className="break-words font-cormorant text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">
                            {offer.product_name}
                        </h3>
                        {offer.variant ? (
                            <p className="mt-1 text-[12.5px] text-slate-500">{offer.variant}</p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                            <span className="text-[1.5rem] font-extrabold leading-none text-slate-900">
                                {formatPrice(offer.price)}
                            </span>
                            {showMrp ? (
                                <>
                                    <span className="text-[13px] text-slate-400 line-through">
                                        {formatPrice(mrp)}
                                    </span>
                                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[12px] font-bold text-[#d77465]">
                                        {Math.round(((mrp - offer.price) / mrp) * 100)}% off
                                    </span>
                                </>
                            ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <Rating offer={offer} />
                            {offer.in_stock === false ? (
                                <span className="text-[12px] font-semibold text-amber-600">Out of stock</span>
                            ) : null}
                        </div>

                        {tagFeatures.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {tagFeatures.map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-600"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>

                {bulletFeatures.length ? (
                    <ul className="mt-5 space-y-2.5">
                        {bulletFeatures.map((item) => {
                            const match = item.match(/^([^-:]{2,60}?)\s*[-:]\s*(.*)$/s)
                            return (
                                <li key={item} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-600">
                                    <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#f3a99a]" />
                                    <span className="break-words">
                                        {match ? (
                                            <><strong className="font-semibold text-slate-800">{match[1]}.</strong> {match[2]}</>
                                        ) : item}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                ) : null}

                {offer.description && !descriptionDuplicatesBullets ? (
                    <p className="mt-5 break-words text-[13.5px] leading-relaxed text-slate-600">
                        {offer.description.length > 600
                            ? `${offer.description.slice(0, 600).trim()}…`
                            : offer.description}
                    </p>
                ) : null}

                {offer.how_to_use ? (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                        <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                            How to use
                        </div>
                        <p className="mt-2 break-words text-[12.5px] leading-relaxed text-slate-500">
                            {offer.how_to_use}
                        </p>
                    </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    {offers.map((item) => (
                        <BuyButton
                            key={item.site}
                            offer={item}
                            productName={productName}
                            primary={item.site === offer.site}
                        />
                    ))}
                </div>

                <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
                    Prices are captured when we last checked {siteName(offer.site)} and may have changed.
                    Confirm on the retailer&apos;s site before buying.
                </p>
            </div>
        </div>
    )
}

export default function RetailerPriceCompare({ productUid, productName, catalogPrice }) {
    const [offers, setOffers] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeOffer, setActiveOffer] = useState(null)

    useEffect(() => {
        const controller = new AbortController()

        async function loadOffers() {
            try {
                const response = await fetch(
                    `/api/product-offers?uid=${encodeURIComponent(productUid)}`,
                    { signal: controller.signal },
                )
                const payload = await response.json()
                if (!response.ok) throw new Error(payload.error || 'Unable to load prices.')

                setOffers(payload.offers || [])
                if (payload.offers?.length) {
                    trackingService.trackEvent(EVENTS.VIEWED_RETAILER_OFFERS, {
                        productName,
                        retailerCount: payload.offers.length,
                        cheapest: payload.cheapest,
                    })
                }
            } catch (error) {
                // A failed or unconfident lookup simply hides the section.
                if (error.name !== 'AbortError') setOffers([])
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        loadOffers()
        return () => controller.abort()
    }, [productUid, productName])

    const openOffer = useCallback((offer) => {
        setActiveOffer(offer)
        trackingService.trackEvent(EVENTS.CLICKED_RETAILER_OFFER, {
            site: offer.site,
            retailer: siteName(offer.site),
            productName,
            price: offer.price,
        })
    }, [productName])

    // Nothing confident to show — render nothing rather than a guess.
    if (loading || !offers.length) return null

    const ownPrice = Number(String(catalogPrice || '').replace(/[^\d.]/g, ''))
    const hasOwnPrice = Number.isFinite(ownPrice) && ownPrice > 0
    const ownOffer = hasOwnPrice
        ? { site: 'roopsee', price: ownPrice, product_name: productName, product_url: roopseeStoreUrl(productUid) }
        : null
    const displayRows = ownOffer
        ? [...offers, ownOffer].sort((a, b) => a.price - b.price)
        : offers
    const cheapest = offers[0]
    const comparedPrices = offers.map((offer) => Number(offer.price)).filter(Number.isFinite)
    if (hasOwnPrice) comparedPrices.push(ownPrice)
    const lowestPrice = Math.min(...comparedPrices)
    const highestPrice = Math.max(...comparedPrices)
    const rangePadding = Math.max(10, Math.round((highestPrice - lowestPrice) * 0.2))
    const rangeStart = Math.max(0, lowestPrice - rangePadding)
    const rangeEnd = highestPrice + rangePadding
    const pricePosition = hasOwnPrice
        ? Math.min(96, Math.max(4, ((ownPrice - rangeStart) / (rangeEnd - rangeStart || 1)) * 100))
        : 50

    return (
        <div className="mt- p-1 min-w-0 bg-white sm:rounded-2xl 
         sm:p-5 s">
            <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">
                    <FiTag aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#f59e0b]" />
                    This price is <span className="text-[#f26f5b]">typical.</span>
                </p>
                <FiChevronUp aria-hidden="true" className="h-4 w-4 text-slate-500" />
            </div>

            <div className="relative mt-7 px-1">
                {hasOwnPrice ? (
                    <span className="absolute -top-5 -translate-x-1/2 rounded bg-orange-100 px-1.5 py-0.5 text-[8px] font-semibold text-[#ec7b20]" style={{ left: `${pricePosition}%` }}>
                        {formatPrice(ownPrice)} is typical
                    </span>
                ) : null}
                <span className="block h-1 rounded-full bg-gradient-to-r from-[#198754] via-[#ff9517] to-[#ff2d63]" />
                {hasOwnPrice ? <span className="absolute top-[-3px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-[#ff9517] shadow" style={{ left: `${pricePosition}%` }} /> : null}
                <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-600">
                    <span>{formatPrice(rangeStart)}</span><span>{formatPrice(rangeEnd)}</span>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] leading-tight text-slate-700">
                    Similar items cost approximately between {formatApproxPrice(lowestPrice)} and {formatApproxPrice(highestPrice)}.
                    <button className="ml-1 text-[9px] text-slate-500 underline" type="button" title="The range is calculated from confident retailer matches and rounded to the nearest rupee.">How was this calculated?</button>
                </div>
                <button className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-950 px-2 py-1.5 text-[10px] font-semibold text-white" onClick={() => openOffer(cheapest)} type="button">
                    <FiThumbsUp aria-hidden="true" className="h-3 w-3" /> Track price
                </button>
            </div>

            <ul className="mt-3 p-1 divide-y divide-slate-100">

                {displayRows.map((row) => (
                    row.site === 'roopsee' ? (
                        <li className="flex items-center gap-2 rounded- bg-rose-50/70 px-1 py-2 sm:gap-3" key="roopsee">
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                <span className="min-w-0">
                                    <RetailerLogo site="roopsee" height={36} />
                                </span>
                                <span className="text-right">
                                    <span className="block text-[14px] font-bold text-slate-900">
                                        {formatPrice(row.price)}
                                    </span>
                                    <span className="text-[10px] font-semibold text-[#d77465]">Roopsee</span>
                                </span>
                            </span>

                            <BuyButton compact offer={row} productName={productName} />
                        </li>
                    ) : (
                        <li className="flex items-center gap-2 px-1 py-2 sm:gap-3" key={row.site}>
                            <button
                                type="button"
                                onClick={() => openOffer(row)}
                                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e08a7d]"
                            >
                                <span className="min-w-0">
                                    <RetailerLogo site={row.site} height={50} />
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                    <span className="text-right">
                                        <span className="block text-[14px] font-medium text-slate-900">
                                            {formatPrice(row.price)}
                                        </span>
                                        <Rating offer={row} />
                                    </span>
                                </span>
                            </button>

                            <BuyButton compact offer={row} productName={productName} />
                        </li>
                    )
                ))}
            </ul>

            {activeOffer ? (
                <OfferModal
                    offer={activeOffer}
                    offers={offers}
                    productName={productName}
                    onClose={() => setActiveOffer(null)}
                />
            ) : null}
        </div>
    )
}
