'use client'

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiChevronRight, FiExternalLink, FiStar, FiTag, FiX } from 'react-icons/fi'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

const SITE_LABELS = { nykaa: 'Nykaa', tira: 'Tira', amazon: 'Amazon' }

function siteLabel(site) {
    return SITE_LABELS[site] || site
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
                aria-label={`Buy ${offer.product_name} from ${siteLabel(offer.site)}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e08a7d] px-3 py-1.5 text-[12px] font-semibold text-[#d77465] transition-colors hover:bg-[#e08a7d] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e08a7d] sm:px-3.5 sm:py-2"
            >
                Buy
                <FiExternalLink aria-hidden="true" className="h-3 w-3" />
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
            Buy from {siteLabel(offer.site)}
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
    const features = [...(offer.key_ingredients || []), ...(offer.key_features || [])].slice(0, 6)

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`${offer.product_name} on ${siteLabel(offer.site)}`}
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-7"
            >
                <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#d77465]">
                        {siteLabel(offer.site)}
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

                        {features.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {features.map((item) => (
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

                {offer.description ? (
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
                    Prices are captured when we last checked {siteLabel(offer.site)} and may have changed.
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
            productName,
            price: offer.price,
        })
    }, [productName])

    // Nothing confident to show — render nothing rather than a guess.
    if (loading || !offers.length) return null

    const ownPrice = Number(String(catalogPrice || '').replace(/[^\d.]/g, ''))
    const hasOwnPrice = Number.isFinite(ownPrice) && ownPrice > 0
    const cheapest = offers[0]
    const saving = hasOwnPrice ? Math.round(ownPrice - cheapest.price) : 0

    return (
        <div className="mt-6 min-w-0 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:mt-8 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FiTag aria-hidden="true" className="h-4 w-4 shrink-0 text-[#e08a7d]" />
                    <span className="text-[13px] font-bold tracking-wide text-slate-800">
                        COMPARE PRICES
                    </span>
                </div>
                {saving > 0 ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700">
                        Save {formatPrice(saving)} on {siteLabel(cheapest.site)}
                    </span>
                ) : null}
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
                {hasOwnPrice ? (
                    <li className="flex items-center justify-between gap-3 py-3">
                        <span className="text-[13px] font-semibold text-slate-800">
                            Roopsee
                            <span className="ml-2 text-[11.5px] font-normal text-slate-400">this page</span>
                        </span>
                        <span className="text-[14px] font-bold text-slate-900">{formatPrice(ownPrice)}</span>
                    </li>
                ) : null}

                {offers.map((offer) => (
                    <li className="flex items-center gap-2 py-3 sm:gap-3" key={offer.site}>
                        <button
                            type="button"
                            onClick={() => openOffer(offer)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e08a7d]"
                        >
                            <span className="min-w-0">
                                <span className="block text-[13px] font-semibold text-slate-800">
                                    {siteLabel(offer.site)}
                                    {offer.site === cheapest.site && offers.length > 1 ? (
                                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-emerald-700">
                                            Best price
                                        </span>
                                    ) : null}
                                </span>
                                <span className="mt-0.5 block truncate text-[11.5px] text-slate-400">
                                    {offer.product_name}
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                                <span className="text-right">
                                    <span className="block text-[14px] font-bold text-slate-900">
                                        {formatPrice(offer.price)}
                                    </span>
                                    <Rating offer={offer} />
                                </span>
                                <FiChevronRight aria-hidden="true" className="h-4 w-4 text-slate-300" />
                            </span>
                        </button>

                        <BuyButton compact offer={offer} productName={productName} />
                    </li>
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
