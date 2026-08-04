"use client"

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { FiSearch } from 'react-icons/fi'
import { HiArrowsUpDown } from 'react-icons/hi2'
import { BsFunnel } from 'react-icons/bs'
import Serum from '@/assets/images/serum.png'
import Header from '@/components/header'
import { useWishlist } from '@/context/WishlistContext'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

const filterTabs = [
    { key: 'brand', label: 'Brand' },
    { key: 'price', label: 'Price' },
    { key: 'category', label: 'Category' },
    { key: 'rating', label: 'Avg Customer Rating' },
    { key: 'country', label: 'Country Of Origin' },
]

const emptyFilters = {
    brand: [],
    price: [],
    category: [],
    rating: [],
    country: [],
}

const emptyFilterOptions = {
    brand: [],
    price: [],
    category: [],
    rating: [],
    country: [],
}

const sortOptions = [
    { label: 'Score high to low', value: 'score_desc' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
    { label: 'Newest First', value: 'newest' },
    { label: 'Customer Rating', value: 'rating' },
]

const PRODUCTS_PER_PAGE = 20

let rememberedProductListState = null

function copyFilters(filters) {
    return Object.fromEntries(
        Object.entries(filters).map(([key, values]) => [key, [...values]]),
    )
}

function ProductCard({ product }) {
    const router = useRouter()
    const { isWishlisted, toggleWishlist } = useWishlist()
    const [nameExpanded, setNameExpanded] = useState(false)
    const savedProduct = {
        ...product,
        product_uid: `retailer-${product.id}`,
        image: product.image_url || '',
        brand_name: product.brand || product.site || 'Roopsee',
        product_name: product.name,
        category: product.categories?.join(', ') || 'Skincare',
        product_type: product.variant || 'Product',
        size: product.variant || 'Size unavailable',
        selling_price: product.selling_price ?? product.price,
    }
    const wishlisted = isWishlisted(savedProduct.product_uid)

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
                source: 'all_products',
            },
        )
    }

    return (
        <div
            role="link"
            tabIndex={0}
            onClick={() => router.push(`/retailer-products/${product.id}`)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    router.push(`/retailer-products/${product.id}`)
                }
            }}
            className="bg-white rounded-lg p-3 flex flex-col cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#e08a7d] focus:ring-offset-2"
        >
            <div className="relative w-full aspect-[3/2] lg:aspect-[3/3] mb-3">
                <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
                    className="object-contain"
                />
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                {product.brand || product.site}
            </p>
            <Link
                href={`/retailer-products/${product.id}`}
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
                {product.name}
            </Link>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-400 line-through">₹{product.originalPrice}</span>
                <span className="text-sm font-semibold text-gray-900">₹{product.price}</span>
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

function FilterPanel({
    open,
    onClose,
    onApply,
    onReset,
    onToggle,
    options,
    optionsLoading,
    selected,
}) {
    const [activeTab, setActiveTab] = useState('brand')
    const [optionSearch, setOptionSearch] = useState('')
    const visibleOptions = options[activeTab].filter((option) =>
        option.label.toLowerCase().includes(optionSearch.trim().toLowerCase()),
    )

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[1000] bg-black/40" onClick={onClose}>
            <div
                className="absolute bottom-0 left-0 right-0 md:top-1/2 md:left-1/2 md:right-auto md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 bg-white rounded-t-2xl md:rounded-2xl w-full md:w-[420px] max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-lato text-lg font-semibold text-gray-900">Filters</h3>
                    <button
                        onClick={onReset}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                    >
                        Reset Filters <span aria-hidden>↻</span>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <div className="w-2/5 bg-gray-50 overflow-y-auto">
                        {filterTabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => {
                                    setActiveTab(tab.key)
                                    setOptionSearch('')
                                }}
                                className={`w-full text-left text-sm px-4 py-3 border-l-4 transition-colors
                  ${activeTab === tab.key
                                        ? 'border-teal-400 bg-white text-gray-900 font-medium'
                                        : 'border-transparent text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                {tab.label}
                                {selected[tab.key].length ? ` (${selected[tab.key].length})` : ''}
                            </button>
                        ))}
                    </div>

                    <div className="w-3/5 overflow-y-auto px-4 py-2">
                        {options[activeTab].length > 10 ? (
                            <input
                                type="search"
                                value={optionSearch}
                                onChange={(event) => setOptionSearch(event.target.value)}
                                placeholder={`Search ${filterTabs.find((tab) => tab.key === activeTab)?.label.toLowerCase()}`}
                                className="sticky top-0 z-10 mb-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#e08a7d]"
                            />
                        ) : null}
                        {optionsLoading ? (
                            <p className="py-4 text-sm text-gray-500">Loading filters…</p>
                        ) : null}
                        {!optionsLoading && options[activeTab].length === 0 ? (
                            <p className="py-4 text-sm text-gray-500">No options available.</p>
                        ) : null}
                        {!optionsLoading && options[activeTab].length > 0 && visibleOptions.length === 0 ? (
                            <p className="py-4 text-sm text-gray-500">No matching options.</p>
                        ) : null}
                        {visibleOptions.map((opt) => (
                            <label
                                key={opt.value}
                                className="flex items-center justify-between py-3 border-b border-gray-50 cursor-pointer"
                            >
                                <span className="text-sm text-gray-700">
                                    {opt.label} <span className="text-gray-400">{opt.count}</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={selected[activeTab].includes(opt.value)}
                                    onChange={() => onToggle(activeTab, opt.value)}
                                    className="w-4 h-4 accent-teal-400 rounded"
                                />
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="flex-1 text-sm font-medium text-[#e08a7d] border border-[#e08a7d] rounded-full py-3 hover:bg-[#fdf0ee] transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={onApply}
                        className="flex-1 text-sm font-medium text-white bg-[#f3a99a] rounded-full py-3 hover:bg-[#e08a7d] transition-colors"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    )
}

function SortPanel({ open, onClose, selectedSort, onSelectSort }) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-[1000] bg-black/40" onClick={onClose}>
            <div
                className="absolute bottom-0 left-0 right-0 md:top-1/2 md:left-1/2 md:right-auto md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 bg-white rounded-t-2xl md:rounded-2xl w-full md:w-[380px] max-h-[70vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-lato text-lg font-semibold text-gray-900">Sort By</h3>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-2">
                    {sortOptions.map((opt) => (
                        <label
                            key={opt.value}
                            className="flex items-center justify-between py-3 border-b border-gray-50 cursor-pointer"
                        >
                            <span className="text-sm text-gray-700">{opt.label}</span>
                            <input
                                type="radio"
                                name="sort"
                                checked={selectedSort === opt.value}
                                onChange={() => onSelectSort(opt.value)}
                                className="w-4 h-4 accent-teal-400"
                            />
                        </label>
                    ))}
                </div>

                <div className="px-5 py-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="w-full text-sm font-medium text-white bg-[#f3a99a] rounded-full py-3 hover:bg-[#e08a7d] transition-colors"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    )
}

function SortFilterBar({ filterCount, onFilterClick, onSortClick, sortLabel }) {
    return (
        <div className="flex items-center justify-around border-y border-gray-200 py-3 bg-white">
            <button onClick={onSortClick} className="flex flex-col items-center gap-1 text-gray-800">
                <span className="flex items-center gap-1 text-sm font-medium">
                    <HiArrowsUpDown size={16} /> Sort By
                </span>
                <span className="text-xs text-gray-400">{sortLabel}</span>
            </button>

            <div className="w-px h-8 bg-gray-200" />

            <button
                onClick={onFilterClick}
                className="flex flex-col items-center gap-1 text-gray-800"
            >
                <span className="flex items-center gap-1 text-sm font-medium">
                    <BsFunnel size={14} /> Filter
                </span>
                <span className="text-xs text-gray-400">
                    {filterCount ? `${filterCount} applied` : 'Apply filter'}
                </span>
            </button>
        </div>
    )
}

function ProductsPageContent() {
    const searchParams = useSearchParams()
    const routeStateKey = searchParams.toString()
    const initialCategories = searchParams.getAll('category')
        .map((category) => category.trim())
        .filter(Boolean)
    const initialFilters = {
        ...emptyFilters,
        category: [...new Set(initialCategories)],
    }
    const restoredState = rememberedProductListState?.routeStateKey === routeStateKey
        ? rememberedProductListState
        : null
    const restoredFilters = restoredState?.appliedFilters || initialFilters
    const [search, setSearch] = useState(() => restoredState?.search || '')
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filterOpen, setFilterOpen] = useState(false)
    const [facetOptions, setFacetOptions] = useState(emptyFilterOptions)
    const [facetOptionsLoading, setFacetOptionsLoading] = useState(true)
    const [draftFilters, setDraftFilters] = useState(() => copyFilters(restoredFilters))
    const [appliedFilters, setAppliedFilters] = useState(() => copyFilters(restoredFilters))
    const [sortOpen, setSortOpen] = useState(false)
    const [selectedSort, setSelectedSort] = useState(() => restoredState?.selectedSort || 'score_desc')
    const [currentPage, setCurrentPage] = useState(() => restoredState?.currentPage || 1)
    const [totalProducts, setTotalProducts] = useState(0)
    const [totalPages, setTotalPages] = useState(1)

    const currentSortLabel = sortOptions.find((s) => s.value === selectedSort)?.label
    const appliedFilterCount = Object.values(appliedFilters)
        .reduce((total, values) => total + values.length, 0)

    useEffect(() => {
        const controller = new AbortController()

        async function loadFilterOptions() {
            try {
                const response = await fetch('/api/retailer-products/facets', {
                    signal: controller.signal,
                })
                const payload = await response.json()

                if (!response.ok) {
                    throw new Error(payload.error || 'Unable to load filters.')
                }

                setFacetOptions(payload.options)
            } catch (fetchError) {
                if (fetchError.name !== 'AbortError') {
                    console.error(fetchError.message)
                }
            } finally {
                if (!controller.signal.aborted) {
                    setFacetOptionsLoading(false)
                }
            }
        }

        loadFilterOptions()
        return () => controller.abort()
    }, [])

    useEffect(() => {
        const controller = new AbortController()

        async function loadProducts() {
            try {
                setLoading(true)
                const params = new URLSearchParams({
                    limit: String(PRODUCTS_PER_PAGE),
                    page: String(currentPage),
                    sort: selectedSort,
                })
                const query = search.trim()
                if (query) params.set('search', query)
                Object.entries(appliedFilters).forEach(([key, values]) => {
                    values.forEach((value) => params.append(key, value))
                })

                const response = await fetch(`/api/retailer-products?${params}`, {
                    signal: controller.signal,
                })
                const payload = await response.json()

                if (!response.ok) {
                    throw new Error(payload.error || 'Unable to load products.')
                }

                setProducts(payload.products.map((product) => ({
                    ...product,
                    name: product.product_name,
                    image: product.image_url || Serum,
                    originalPrice: product.mrp ?? product.selling_price ?? 0,
                    price: product.selling_price ?? product.mrp ?? 0,
                })))
                setTotalProducts(payload.total || 0)
                setTotalPages(payload.totalPages || 1)
                setError('')
            } catch (fetchError) {
                if (fetchError.name !== 'AbortError') {
                    setError(fetchError.message)
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            }
        }

        const timeoutId = setTimeout(loadProducts, 300)
        return () => {
            clearTimeout(timeoutId)
            controller.abort()
        }
    }, [appliedFilters, currentPage, search, selectedSort])

    useEffect(() => {
        rememberedProductListState = {
            routeStateKey,
            search,
            appliedFilters: copyFilters(appliedFilters),
            selectedSort,
            currentPage,
        }
    }, [appliedFilters, currentPage, routeStateKey, search, selectedSort])

    const openFilters = () => {
        setDraftFilters(Object.fromEntries(
            Object.entries(appliedFilters).map(([key, values]) => [key, [...values]]),
        ))
        setFilterOpen(true)
    }

    const closeFilters = () => {
        setFilterOpen(false)
    }

    const toggleFilter = (group, value) => {
        setDraftFilters((current) => ({
            ...current,
            [group]: current[group].includes(value)
                ? current[group].filter((item) => item !== value)
                : [...current[group], value],
        }))
    }

    const resetFilters = () => {
        setDraftFilters(Object.fromEntries(
            Object.keys(emptyFilters).map((key) => [key, []]),
        ))
    }

    const applyFilters = () => {
        setAppliedFilters(Object.fromEntries(
            Object.entries(draftFilters).map(([key, values]) => [key, [...values]]),
        ))
        setCurrentPage(1)
        setFilterOpen(false)
    }

    const firstProductNumber = totalProducts ? (currentPage - 1) * PRODUCTS_PER_PAGE + 1 : 0
    const lastProductNumber = Math.min(currentPage * PRODUCTS_PER_PAGE, totalProducts)
    const firstPageButton = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
    const pageNumbers = Array.from(
        { length: Math.min(5, totalPages) },
        (_, index) => Math.max(1, firstPageButton) + index,
    )

    return (
        <div>
            <Header />
            <SortFilterBar
                filterCount={appliedFilterCount}
                onFilterClick={openFilters}
                onSortClick={() => setSortOpen(true)}
                sortLabel={currentSortLabel}
            />
            <FilterPanel
                open={filterOpen}
                onApply={applyFilters}
                onClose={closeFilters}
                onReset={resetFilters}
                onToggle={toggleFilter}
                options={facetOptions}
                optionsLoading={facetOptionsLoading}
                selected={draftFilters}
            />
            <SortPanel
                open={sortOpen}
                onClose={() => setSortOpen(false)}
                selectedSort={selectedSort}
                onSelectSort={(sort) => {
                    setSelectedSort(sort)
                    setCurrentPage(1)
                }}
            />

            <div className="max-w-6xl mx-auto px-3 bg-[#FAF9F6] py-6">
                <h1 style={{ letterSpacing: '0.1em' }} className="font-lato uppercase text-2xl md:text-3xl text-center tracking- mb-1">
                    Products
                </h1>

                <div className="relative max-w-xl mx-auto mb-2 mt-3">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#e08a7d]" size={18} />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setCurrentPage(1)
                        }}
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
                {!loading && !error && products.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No products found.</p>
                ) : null}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3 md:gap-6">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>

                {!loading && !error && totalProducts > 0 ? (
                    <nav className="mt-8 flex flex-col items-center gap-3" aria-label="Product pages">
                        <p className="text-xs text-gray-500">
                            Showing {firstProductNumber}–{lastProductNumber} of {totalProducts} products
                        </p>
                        <div className="flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                                disabled={currentPage === 1}
                                className="rounded-full border border-[#e08a7d] px-3 py-2 text-xs text-[#d17a6d] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Previous
                            </button>
                            {pageNumbers.map((pageNumber) => (
                                <button
                                    type="button"
                                    key={pageNumber}
                                    onClick={() => setCurrentPage(pageNumber)}
                                    aria-current={currentPage === pageNumber ? 'page' : undefined}
                                    className={`h-9 w-9 rounded-full text-xs font-semibold transition-colors ${
                                        currentPage === pageNumber
                                            ? 'bg-[#e08a7d] text-white'
                                            : 'border border-gray-200 bg-white text-gray-700 hover:border-[#e08a7d]'
                                    }`}
                                >
                                    {pageNumber}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="rounded-full border border-[#e08a7d] px-3 py-2 text-xs text-[#d17a6d] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </nav>
                ) : null}
            </div>
        </div>
    )
}

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#FAF9F6]" />}>
            <ProductsPageContent />
        </Suspense>
    )
}
