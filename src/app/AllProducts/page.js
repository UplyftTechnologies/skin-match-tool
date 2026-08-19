"use client"

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { FiSearch } from 'react-icons/fi'
import { HiArrowsUpDown } from 'react-icons/hi2'
import { BsFunnel, BsHeartFill } from 'react-icons/bs'
import { BiHeart } from 'react-icons/bi'
import Serum from '@/assets/images/serum.png'
import Header from '@/components/header'
import { useWishlist } from '@/context/WishlistContext'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import { scoredProductPath } from '@/lib/site'
import { useScoredProducts } from '@/hooks/use-scored-products'
import ScoreBadge from '@/components/score-badge'

const filterTabs = [
    { key: 'brand', label: 'Brand' },
    { key: 'price', label: 'Price' },
    { key: 'category', label: 'Category' },
    { key: 'score', label: 'Match Score' },
    { key: 'type', label: 'Product Type' },
]

const emptyFilters = {
    brand: [],
    price: [],
    category: [],
    score: [],
    type: [],
}

const sortOptions = [
    { label: 'Score high to low', value: 'score_desc' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
    { label: 'Score low to high', value: 'score_asc' },
    { label: 'Name: A to Z', value: 'name_asc' },
]

const PRODUCTS_PER_PAGE = 20

let rememberedProductListState = null

function copyFilters(filters) {
    return Object.fromEntries(
        Object.entries(filters).map(([key, values]) => [key, [...values]]),
    )
}

function productPrice(product) {
    return Number(product.selling_price || product.mrp || 0)
}

function countOptions(values) {
    const counts = new Map()
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1))
    return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([value, count]) => ({ value, label: value, count }))
}

function scoreRange(score) {
    if (score >= 90) return '90_100'
    if (score >= 80) return '80_89'
    if (score >= 70) return '70_79'
    if (score >= 50) return '50_69'
    return 'under_50'
}

function matchesCategory(product, category) {
    const wanted = category.toLowerCase()
    const text = `${product.product_name} ${product.product_type}`.toLowerCase()
    if (wanted === 'lips' || wanted === 'lip') return text.includes('lip')
    if (wanted === 'eyes' || wanted === 'eye') return /\beye|eyelash|eyebrow/.test(text)
    return product.category?.toLowerCase() === wanted
}

function ProductCard({ product }) {
    const router = useRouter()
    const { isWishlisted, toggleWishlist } = useWishlist()
    const [imageFailed, setImageFailed] = useState(false)
    const savedProduct = product
    const wishlisted = isWishlisted(savedProduct.product_uid)
    const productHref = scoredProductPath(product.product_uid, product.score)

    function handleSaveMatch(event) {
        event.stopPropagation()
        if (!toggleWishlist(savedProduct)) return
        const eventProps = {
            productId: savedProduct.product_uid,
            productName: savedProduct.product_name,
            brand: savedProduct.brand_name,
            price: savedProduct.selling_price || savedProduct.mrp,
            source: 'all_products',
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
            section: 'all_products',
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
            <div className="relative w-full aspect-[3/2] lg:aspect-[3/3] mb-3">
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
                <Image
                    src={imageFailed || !product.image ? Serum : product.image}
                    alt={product.product_name}
                    fill
                    sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
                    className="object-contain"
                    onError={() => setImageFailed(true)}
                />
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
                className="product-name-clamp mb-2 min-h-[2.75rem] text-[15px] font-lato leading-snug text-gray-800 transition hover:text-[#e08a7d] hover:underline lg:text-[16px]"
            >
                {product.product_name}
            </Link>
            <div className="flex items-center gap-2 mb-3">
             
                <span className="text-sm font-semibold text-gray-900">
                    {product.selling_price || product.mrp ? `₹${Math.ceil(product.selling_price || product.mrp)}` : 'Price unavailable'}
                </span>
            </div>
            <button
                type="button"
                onClick={handleBuyNow}
                style={{ fontSize: '11px' }}
                className="mt-auto w-[90%] mx-auto font-semibold border rounded-full py-[8px] transition-colors duration-200 text-white bg-[#e08a7d] border-[#e08a7d] hover:bg-[#d17a6d]"
            >
                Buy Now
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

function SortPanel({ open, onClose, onApply, selectedSort, onSelectSort }) {
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
                        onClick={onApply}
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
    const initialTypes = searchParams.getAll('type')
        .map((type) => type.trim())
        .filter(Boolean)
    const initialBrands = searchParams.getAll('brand')
        .map((brand) => brand.trim())
        .filter(Boolean)
    const initialFilters = {
        ...emptyFilters,
        category: [...new Set(initialCategories)],
        type: [...new Set(initialTypes)],
        brand: [...new Set(initialBrands)],
    }
    const restoredState = rememberedProductListState?.routeStateKey === routeStateKey
        ? rememberedProductListState
        : null
    const restoredFilters = restoredState?.appliedFilters || initialFilters
    const [search, setSearch] = useState(() => restoredState?.search || '')
    const { products: scoredProducts, loading, error } = useScoredProducts()
    const [filterOpen, setFilterOpen] = useState(false)
    const [draftFilters, setDraftFilters] = useState(() => copyFilters(restoredFilters))
    const [appliedFilters, setAppliedFilters] = useState(() => copyFilters(restoredFilters))
    const [sortOpen, setSortOpen] = useState(false)
    const [selectedSort, setSelectedSort] = useState(() => restoredState?.selectedSort || 'score_desc')
    const [currentPage, setCurrentPage] = useState(() => restoredState?.currentPage || 1)

    const currentSortLabel = sortOptions.find((s) => s.value === selectedSort)?.label
    const appliedFilterCount = Object.values(appliedFilters)
        .reduce((total, values) => total + values.length, 0)

    // Fires whenever the incoming URL changes — this is what actually catches
    // filters carried over from a home page card (Search by Product/Category/
    // K-Beauty/Indian Rockstar), since those land here via query params.
    useEffect(() => {
        trackingService.trackPageLoad(EVENTS.PAGE_VIEWED_ALL_PRODUCTS, {
            page_type: 'all_products',
            type: initialTypes,
            category: initialCategories,
            brand: initialBrands,
            filters_applied_from_url: Boolean(initialTypes.length || initialCategories.length || initialBrands.length),
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeStateKey])

    // Supabase retailer-product loading is intentionally paused. The new design
    // currently uses the same scored CSV catalog as Match Studio.
    const facetOptions = useMemo(() => ({
        brand: countOptions(scoredProducts.map((product) => product.brand_name)),
        price: [
            { value: 'under_500', label: 'Under ₹500', count: scoredProducts.filter((product) => productPrice(product) < 500).length },
            { value: '500_1000', label: '₹500–₹1,000', count: scoredProducts.filter((product) => productPrice(product) >= 500 && productPrice(product) <= 1000).length },
            { value: 'over_1000', label: 'Over ₹1,000', count: scoredProducts.filter((product) => productPrice(product) > 1000).length },
        ],
        category: countOptions(scoredProducts.map((product) => product.category)),
        score: [
            { value: '90_100', label: 'Excellent (90–100)', count: scoredProducts.filter((product) => scoreRange(product.score) === '90_100').length },
            { value: '80_89', label: 'Great (80–89)', count: scoredProducts.filter((product) => scoreRange(product.score) === '80_89').length },
            { value: '70_79', label: 'Good (70–79)', count: scoredProducts.filter((product) => scoreRange(product.score) === '70_79').length },
            { value: '50_69', label: 'Caution (50–69)', count: scoredProducts.filter((product) => scoreRange(product.score) === '50_69').length },
            { value: 'under_50', label: 'Not recommended', count: scoredProducts.filter((product) => scoreRange(product.score) === 'under_50').length },
        ],
        type: countOptions(scoredProducts.map((product) => product.product_type)),
    }), [scoredProducts])

    const filteredProducts = useMemo(() => {
        const query = search.trim().toLowerCase()
        const matches = scoredProducts.filter((product) => {
            if (query && ![
                product.product_name,
                product.brand_name,
                product.category,
                product.product_type,
            ].some((value) => value?.toLowerCase().includes(query))) return false
            if (appliedFilters.brand.length && !appliedFilters.brand.includes(product.brand_name)) return false
            if (appliedFilters.category.length
                && !appliedFilters.category.some((category) => matchesCategory(product, category))) return false
            if (appliedFilters.type.length && !appliedFilters.type.includes(product.product_type)) return false
            if (appliedFilters.score.length && !appliedFilters.score.includes(scoreRange(product.score))) return false

            const price = productPrice(product)
            if (appliedFilters.price.length && !appliedFilters.price.some((range) => (
                (range === 'under_500' && price < 500)
                || (range === '500_1000' && price >= 500 && price <= 1000)
                || (range === 'over_1000' && price > 1000)
            ))) return false
            return true
        })

        return matches.sort((left, right) => {
            if (selectedSort === 'score_asc') return left.score - right.score
            if (selectedSort === 'price_asc') return productPrice(left) - productPrice(right)
            if (selectedSort === 'price_desc') return productPrice(right) - productPrice(left)
            if (selectedSort === 'name_asc') return left.product_name.localeCompare(right.product_name)
            return right.score - left.score
        })
    }, [appliedFilters, scoredProducts, search, selectedSort])

    const totalProducts = filteredProducts.length
    const totalPages = Math.max(Math.ceil(totalProducts / PRODUCTS_PER_PAGE), 1)
    const products = filteredProducts.slice(
        (currentPage - 1) * PRODUCTS_PER_PAGE,
        currentPage * PRODUCTS_PER_PAGE,
    )

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
        trackingService.trackEvent(EVENTS.CLICKED_RESET_FILTERS, {
            section: 'all_products',
        })

        setDraftFilters(Object.fromEntries(
            Object.keys(emptyFilters).map((key) => [key, []]),
        ))
    }

    const applySort = () => {
        trackingService.trackEvent(EVENTS.CLICKED_SORT_OPTION, {
            sort: selectedSort,
            section: 'all_products',
        })

        setSortOpen(false)
    }

    const applyFilters = () => {
        trackingService.trackEvent(EVENTS.CLICKED_FILTER_OPTION, {
            filters: draftFilters,
            filterCount: Object.values(draftFilters).reduce((total, values) => total + values.length, 0),
            section: 'all_products',
        })

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
                optionsLoading={loading}
                selected={draftFilters}
            />
            <SortPanel
                open={sortOpen}
                onClose={() => setSortOpen(false)}
                onApply={applySort}
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

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2 mt-3 md:gap-6">
                    {products.map((product) => (
                        <ProductCard key={product.product_uid} product={product} />
                    ))}
                </div>

                {!loading && !error && totalProducts > 0 ? (
                    <nav className="mt-8 flex flex-col items-center gap-3" aria-label="Product pages">
                        <p className="text-xs text-gray-500">
                            Showing {firstProductNumber}–{lastProductNumber} of {totalProducts} products
                        </p>
                        <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                                disabled={currentPage === 1}
                                className="shrink-0 rounded-full border border-[#e08a7d] px-2.5 py-1.5 text-[11px] text-[#d17a6d] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-2 sm:text-xs"
                            >
                                Previous
                            </button>
                            {pageNumbers.map((pageNumber) => (
                                <button
                                    type="button"
                                    key={pageNumber}
                                    onClick={() => setCurrentPage(pageNumber)}
                                    aria-current={currentPage === pageNumber ? 'page' : undefined}
                                    className={`h-8 w-8 shrink-0 rounded-full text-[11px] font-semibold transition-colors sm:h-9 sm:w-9 sm:text-xs ${
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
                                className="shrink-0 rounded-full border border-[#e08a7d] px-2.5 py-1.5 text-[11px] text-[#d17a6d] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-2 sm:text-xs"
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
