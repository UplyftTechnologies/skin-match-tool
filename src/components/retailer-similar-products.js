/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiShoppingBag } from 'react-icons/fi'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import { quizAnswersToScoringProfile } from '@/lib/quiz-profile'
import { getSavedSkinProfile } from '@/lib/profile-storage'
import SaveProductButton from '@/components/save-product-button'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

function formatPrice(value) {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? `Rs. ${Math.ceil(number)}` : null
}

function SimilarCard({ product }) {
    const [imageFailed, setImageFailed] = useState(false)
    const price = formatPrice(product.selling_price ?? product.mrp)
    const href = `/retailer-products/${encodeURIComponent(product.product_uid)}`
    const score = product.scoring?.blocked ? null : product.scoring?.score

    return (
        <div className="relative w-[150px] shrink-0 snap-start sm:w-[180px]">
            <SaveProductButton
                product={product}
                label=""
                className="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#d77465] shadow-sm transition hover:bg-white"
            />
            {Number.isFinite(score) ? (
                <span
                    className={`absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shadow ${
                        score >= 80 ? 'bg-emerald-600' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    title={product.scoring?.label}
                >
                    {score}
                </span>
            ) : null}

            <Link
                href={href}
                onClick={() =>
                    trackingService.trackEvent(EVENTS.CLICKED_PRODUCT_CARD, {
                        productId: product.product_uid,
                        productName: product.product_name,
                        brand: product.brand_name,
                        section: 'similar_products',
                    })
                }
                className="block rounded-2xl border border-slate-100 bg-white p-2.5 transition hover:shadow-md"
            >
                <div className="flex h-[120px] items-center justify-center overflow-hidden rounded-xl bg-slate-50 sm:h-[140px]">
                    {imageFailed || !product.image ? (
                        <span className="text-[20px] font-bold text-slate-300">R</span>
                    ) : (
                        <img
                            src={product.image}
                            alt={product.product_name}
                            onError={() => setImageFailed(true)}
                            className="h-full w-full object-contain"
                        />
                    )}
                </div>
                <p className="mt-2 truncate text-[9.5px] font-extrabold uppercase tracking-wider text-[#e08a7d]">
                    {product.brand_name}
                </p>
                <p className="product-name-clamp mt-0.5 min-h-[2.2rem] text-[12px] leading-snug text-slate-700">
                    {product.product_name}
                </p>
                {price ? (
                    <p className="mt-1 text-[12.5px] font-bold text-slate-900">{price}</p>
                ) : null}
            </Link>
        </div>
    )
}

/**
 * "You may also like" for a retailer product.
 *
 * Same category, ranked by skin-match score. It runs client-side because the
 * score depends on the visitor's quiz answers, which live in the browser — the
 * page itself is a server component and cannot see them.
 */
export default function RetailerSimilarProducts({ category, excludeUid }) {
    const quizAnswers = useQuizAnswers()
    const [savedProfile, setSavedProfile] = useState(null)
    const [products, setProducts] = useState([])

    useEffect(() => {
        const timer = setTimeout(() => {
            setSavedProfile(getSavedSkinProfile()?.profile || null)
        }, 0)
        return () => clearTimeout(timer)
    }, [quizAnswers])

    useEffect(() => {
        if (!category) return undefined
        const controller = new AbortController()

        const profile = quizAnswers
            ? quizAnswersToScoringProfile(quizAnswers)
            : savedProfile?.selectedSkinType
              ? savedProfile
              : null

        const params = new URLSearchParams({ category, page: '1' })
        // Without a profile there is no score to rank on, so fall back to the
        // catalogue's own quality signal rather than returning an arbitrary page.
        params.set('sort', profile ? 'score_desc' : 'rating')
        if (profile) {
            params.set('skinType', profile.selectedSkinType)
            params.set('sensitive', profile.selectedSensitive ? '1' : '0')
            params.set('age', profile.age || 'Adult')
            const concern = [
                ...(profile.selectedFaceBodyConcerns || []),
                ...(profile.selectedLipsEyesConcerns || []),
            ].find((item) => item && item !== 'None')
            params.set('concern', concern || 'None')
            for (const condition of profile.selectedSpecialConditions || []) {
                if (condition) params.append('condition', condition)
            }
        }

        fetch(`/api/retailer-products/catalog?${params}`, { signal: controller.signal })
            .then((response) => response.json())
            .then((payload) => {
                setProducts(
                    (payload.products || [])
                        .filter((item) => String(item.product_uid) !== String(excludeUid))
                        // A hard-blocked product is not a recommendation.
                        .filter((item) => !item.scoring?.blocked)
                        .slice(0, 10),
                )
            })
            .catch(() => {})

        return () => controller.abort()
    }, [category, excludeUid, quizAnswers, savedProfile])

    if (!products.length) return null

    return (
        <div className="mt-6 min-w-0 bg-white p-3 sm:mt-8 sm:rounded-2xl sm:border sm:border-slate-100 sm:p-5 sm:shadow-sm">
            <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">
                <FiShoppingBag aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#e08a7d]" />
                You may also like
            </p>
            <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
                {products.map((product) => (
                    <SimilarCard key={product.product_uid} product={product} />
                ))}
            </div>
        </div>
    )
}
