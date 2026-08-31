'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { IoClose } from 'react-icons/io5'
import { matchLabel, matchClasses } from '@/lib/routine-match'

// Categories a shopper can add as an extra routine step beyond the four
// fixed ones (Cleanser/Serum/Moisturiser/Sunscreen) — matches canonicalCategory()
// in lib/retailer-catalog.js.
const CATEGORY_OPTIONS = [
    'Toner', 'Mask', 'Exfoliator', 'Eye Care', 'Lip Care', 'Body Care', 'Hair Care', 'Treatment',
]

function buildQuery({ categories, profile }) {
    const params = new URLSearchParams()
    params.set('sort', 'score_desc')
    params.set('page', '1')
    categories.forEach((category) => params.append('category', category))
    if (profile?.selectedSkinType) {
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
    return params.toString()
}

// A self-contained picker: fetches its own scored candidates rather than
// relying on the parent page's four fixed-category hooks, since an "extra"
// step's category is chosen inside this modal and can be anything.
//
// The caller mounts this with a `key` that changes on every open (see
// build-routine/page.js) so `category` re-initialises fresh per step instead
// of being reset by an effect that syncs it to the `open`/`categories` props.
export default function ProductPickerModal({ open, onClose, title, categories, allowCategoryChange, profile, onSelect }) {
    const [category, setCategory] = useState(() => categories?.[0] || CATEGORY_OPTIONS[0])
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return undefined
        const controller = new AbortController()
        setLoading(true)
        const activeCategories = allowCategoryChange ? [category] : (categories?.length ? categories : [category])
        fetch(`/api/retailer-products/catalog?${buildQuery({ categories: activeCategories, profile })}`, {
            signal: controller.signal,
        })
            .then((response) => response.json())
            .then((payload) => setProducts(payload.products || []))
            .catch((error) => {
                if (error.name !== 'AbortError') setProducts([])
            })
            .finally(() => setLoading(false))

        return () => controller.abort()
    }, [open, category, categories, allowCategoryChange, profile])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
            <div
                className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h3 className="font-lato text-base font-semibold text-gray-900">{title}</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700">
                        <IoClose size={20} />
                    </button>
                </div>

                {allowCategoryChange ? (
                    <div className="border-b border-gray-100 px-5 py-3">
                        <select
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#e08a7d]"
                        >
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                ) : null}

                <div className="flex-1 overflow-y-auto px-2 py-2">
                    {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading products…</p> : null}
                    {!loading && products.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500">No products found.</p>
                    ) : null}
                    {products.map((product) => {
                        const score = product.scoring?.score
                        const hasScore = Number.isFinite(Number(score))
                        return (
                            <button
                                key={product.product_uid}
                                type="button"
                                onClick={() => onSelect(product, category)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                            >
                                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                                    {product.image ? (
                                        <Image src={product.image} alt="" fill sizes="40px" className="object-contain" />
                                    ) : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[11px] font-semibold uppercase text-gray-400">
                                        {product.brand_name}
                                    </span>
                                    <span className="block truncate text-sm font-medium text-gray-800">
                                        {product.product_name}
                                    </span>
                                </span>
                                {hasScore ? (
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${matchClasses(score)}`}>
                                        {Math.round(score)} · {matchLabel(score)}
                                    </span>
                                ) : null}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
