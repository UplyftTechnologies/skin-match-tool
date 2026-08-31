'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { FiSearch } from 'react-icons/fi'
import Header from '@/components/header'
import { useScoredProducts } from '@/hooks/use-scored-products'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

import IR1 from '@/assets/indianrockstar/i1.png'
import IR2 from '@/assets/indianrockstar/i2.png'
import IR3 from '@/assets/indianrockstar/i3.png'
import IR4 from '@/assets/indianrockstar/i4.png'
import IR5 from '@/assets/indianrockstar/i5.png'
import IR6 from '@/assets/indianrockstar/i6.png'
import IR7 from '@/assets/indianrockstar/i7.png'
import KB1 from '@/assets/Kbeauty/k1.png'
import KB2 from '@/assets/Kbeauty/k2.png'
import KB3 from '@/assets/Kbeauty/k3.png'
import KB4 from '@/assets/Kbeauty/k4.png'
import KB5 from '@/assets/Kbeauty/k5.png'
import KB6 from '@/assets/Kbeauty/k6.png'
import KB7 from '@/assets/Kbeauty/k7.png'

// Curated logos already exist for the brands featured in the home page
// carousels (IndianRockstar.js / SearchByBrands.js) — reuse them here so
// those tiles look the same. Every other brand falls back to an initial.
const BRAND_LOGOS = {
    'Minimalist': IR1,
    'The Derma Co': IR2,
    'Plum': IR3,
    "Re'equil": IR4,
    'Dot & Key': IR5,
    "Dr. Sheth's": IR6,
    'Chemist At Play': IR7,
    'Laneige': KB1,
    'Innisfree': KB2,
    'Celimax': KB3,
    'COSRX': KB4,
    'SOME BY MI': KB5,
    'The Face Shop': KB6,
    'Anua': KB7,
}

function brandHref(brand) {
    const params = new URLSearchParams()
    params.append('brand', brand)
    return `/AllProducts?${params}`
}

function BrandInitial({ name }) {
    const letter = (name || '?').trim().charAt(0).toUpperCase()
    return (
        <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#f8eeeb] text-2xl font-bold text-[#d77465]">
            {letter}
        </div>
    )
}

// Most brands have no curated logo, so fall back to a real product shot from
// that brand's own catalog rather than leaving every other tile as a bare
// initial — it still reads as "this brand is on the platform".
function BrandLogo({ brand }) {
    const [failed, setFailed] = useState(false)
    const curated = BRAND_LOGOS[brand.name]

    if (curated) {
        return (
            <Image src={curated} alt={brand.name} fill sizes="80px" className="object-cover" />
        )
    }

    if (brand.image && !failed) {
        return (
            <img
                src={brand.image}
                alt={brand.name}
                loading="lazy"
                onError={() => setFailed(true)}
                className="h-full w-full object-cover"
            />
        )
    }

    return <BrandInitial name={brand.name} />
}

export default function BrandsPage() {
    const router = useRouter()
    const { products, loading, error } = useScoredProducts()
    const [search, setSearch] = useState('')

    useEffect(() => {
        trackingService.trackPageLoad(EVENTS.PAGE_VIEWED_ALL_BRANDS, {
            page_type: 'all_brands',
        })
    }, [])

    const brands = useMemo(() => {
        const byBrand = new Map()
        products.forEach((product) => {
            const name = product.brand_name?.trim()
            if (!name) return
            const entry = byBrand.get(name) || { count: 0, image: '' }
            entry.count += 1
            if (!entry.image && product.image) entry.image = product.image
            byBrand.set(name, entry)
        })
        return [...byBrand.entries()]
            .map(([name, entry]) => ({ name, count: entry.count, image: entry.image }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [products])

    const visibleBrands = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return brands
        return brands.filter((brand) => brand.name.toLowerCase().includes(query))
    }, [brands, search])

    const handleBrandClick = (brand) => {
        trackingService.trackEvent(EVENTS.CLICKED_BRAND_TILE, {
            brand: brand.name,
            productCount: brand.count,
            source: 'all_brands',
        })
        router.push(brandHref(brand.name))
    }

    return (
        <div className="min-h-screen bg-[#FAF9F6]">
            <Header />
            <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
                <h2 style={{ letterSpacing: '0.1em' }} className="font-lato uppercase text-2xl md:text-3xl text-center tracking- mb-1">
                    All Brands
                </h2>
                {!loading && !error ? (
                    <p className="text-center text-sm text-gray-500 mt-2">{brands.length} brands on Roopsee</p>
                ) : null}

                <div className="relative max-w-xl mx-auto mt-5">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#e08a7d]" size={18} />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search brands"
                        className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#e08a7d] shadow-sm"
                    />
                </div>

                {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading brands…</p> : null}
                {error ? <p className="py-8 text-center text-sm text-red-600">{error}</p> : null}
                {!loading && !error && visibleBrands.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No matching brands.</p>
                ) : null}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-6">
                    {visibleBrands.map((brand) => (
                        <button
                            key={brand.name}
                            type="button"
                            onClick={() => handleBrandClick(brand)}
                            aria-label={`Shop ${brand.name}`}
                            className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <div className="relative h-20 w-20 overflow-hidden rounded-2xl">
                                <BrandLogo brand={brand} />
                            </div>
                            <span className="text-[13px] font-semibold text-gray-800 line-clamp-2">{brand.name}</span>
                            <span className="text-[11px] text-gray-400">{brand.count} products</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
