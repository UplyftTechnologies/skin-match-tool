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

function buildQuery({ categories, profile, search, minScore, sort, page }) {
    const params = new URLSearchParams()
    params.set('sort', sort)
    params.set('page', String(page))
    if (search.trim()) params.set('search', search.trim())
    if (minScore) params.set('minScore', minScore)
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
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [minScore, setMinScore] = useState('')
    const [sort, setSort] = useState('score_desc')
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
    const [error, setError] = useState('')
    const [retry, setRetry] = useState(0)
    const query = buildQuery({
        categories: allowCategoryChange ? [category] : (categories?.length ? categories : [category]),
        profile, search, minScore, sort, page,
    })

    function changeFilter(setter, value) {
        setter(value)
        if (setter !== setPage) setPage(1)
        setLoading(true)
        setError('')
        setProducts([])
    }

    useEffect(() => {
        if (!open) return undefined
        const controller = new AbortController()
        const timer = setTimeout(() => {
            setLoading(true)
            setError('')
            setProducts([])
            fetch(`/api/retailer-products/catalog?${query}`, {
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) throw new Error('Unable to load products. Please try again.')
                return response.json()
            })
            .then((payload) => {
                if (controller.signal.aborted) return
                setProducts(payload.products || [])
                setPagination({ total: payload.total, page: payload.page, totalPages: payload.totalPages })
            })
            .catch((error) => {
                if (!controller.signal.aborted) setError(error.message || 'Unable to load products.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        }, 250)

        return () => { clearTimeout(timer); controller.abort() }
    }, [open, query, retry])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white"
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
                            aria-label="Product category"
                            onChange={(event) => changeFilter(setCategory, event.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#e08a7d]"
                        >
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                ) : null}

                <div className="space-y-3 border-b border-gray-100 px-5 py-3">
                    <label className="block text-xs font-medium text-gray-600">
                        Search products
                        <input type="search" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)}
                            placeholder="Product or brand" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-medium text-gray-600">
                            Match score
                            <select value={minScore} disabled={!profile?.selectedSkinType}
                                onChange={(event) => changeFilter(setMinScore, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm disabled:opacity-50">
                                <option value="">All scores</option>
                                <option value="90">90 and above</option>
                                <option value="80">80 and above</option>
                                <option value="60">60 and above</option>
                            </select>
                        </label>
                        <label className="text-xs font-medium text-gray-600">
                            Sort by
                            <select value={sort} onChange={(event) => changeFilter(setSort, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm">
                                <option value="score_desc">Best match</option>
                                <option value="price_asc">Lowest price</option>
                                <option value="price_desc">Highest price</option>
                                <option value="name_asc">Name: A to Z</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-busy={loading}>
                    {error ? <div role="alert" className="p-4 text-center text-sm text-[#D17A6D]">
                        <p>{error}</p>
                        <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 underline">Try again</button>
                    </div> : null}
                    {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading products…</p> : null}
                    {!loading && !error && products.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500">No products found.</p>
                    ) : null}
                    {products.map((product) => {
                        const score = product.scoring?.score
                        const hasScore = score != null && Number.isFinite(Number(score))
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
                {!loading && !error ? <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-600">
                    <span role="status">{pagination.total} products</span>
                    <div className="flex items-center gap-3">
                        <button type="button" disabled={pagination.page <= 1} onClick={() => changeFilter(setPage, pagination.page - 1)}
                            className="py-2 disabled:opacity-40">Previous</button>
                        <span>{pagination.page} / {pagination.totalPages}</span>
                        <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => changeFilter(setPage, pagination.page + 1)}
                            className="py-2 disabled:opacity-40">Next</button>
                    </div>
                </div> : null}
            </div>
        </div>
    )
}
