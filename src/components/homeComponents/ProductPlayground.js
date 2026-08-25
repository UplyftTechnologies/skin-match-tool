'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { FiArrowRight, FiCheck, FiChevronDown, FiGitMerge } from 'react-icons/fi'

function numericPrice(product) {
    const value = Number(String(product?.selling_price || product?.mrp || '').replace(/[^\d.]/g, ''))
    return Number.isFinite(value) ? value : null
}

function displayPrice(product) {
    const value = numericPrice(product)
    return value === null ? 'Price unavailable' : `Rs. ${value.toLocaleString('en-IN')}`
}

function scoreTone(score) {
    if (score >= 90) return 'bg-[#edf7f0] text-[#416b4e]'
    if (score >= 50) return 'bg-[#fff8e8] text-[#82601f]'
    return 'bg-[#fff0ee] text-[#96483f]'
}

function keyIngredients(product) {
    const values = [
        product.hero_ingredient,
        ...(Array.isArray(product.secondary_hero_ingredients)
            ? product.secondary_hero_ingredients
            : String(product.secondary_hero_ingredients || '').split(/[,;|]/)),
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)

    if (values.length) return [...new Set(values)].slice(0, 4)

    return String(product.ingredients || '')
        .split(/[,;|]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 4)
}

function suitability(product, skinType) {
    const score = Number(product.score)
    const profile = skinType ? `${skinType} skin profile` : 'skin profile'
    if (score >= 90) return `Highly suitable for your ${profile}`
    if (score >= 50) return `Can suit your ${profile}, with some caution`
    return `Not recommended for your ${profile}`
}

function comparisonCategory(product) {
    return product?.product_type || product?.category || 'Skincare'
}

function IngredientComparison({ product }) {
    const ingredients = keyIngredients(product)
    return (
        <div className="px-2 py-4 sm:px-4">
            {ingredients.length ? (
                <div className="flex flex-wrap justify-center gap-1">
                    {ingredients.map((ingredient) => (
                        <span key={ingredient} className="rounded bg-[#f8eeeb] px-1.5 py-1 text-center text-[9px] leading-tight text-[#765952] sm:px-2 sm:text-[11px]">
                            {ingredient}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-center text-gray-400">Not listed</p>
            )}
        </div>
    )
}

function ProductPicker({ label, products, selectedId, disabledId, onChange }) {
    const [open, setOpen] = useState(false)
    const selected = products.find((product) => product.product_uid === selectedId)

    return (
        <div className="relative min-w-0">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:text-xs">
                {label}
            </p>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className="flex h-14 w-full min-w-0 items-center gap-2 rounded-md border border-gray-200 bg-[#fcfbfa] px-2.5 text-left outline-none transition-colors hover:border-[#d9aaa2] focus:border-[#d77465] sm:h-16 sm:px-3"
            >
                <span className="relative h-9 w-9 shrink-0 bg-white sm:h-11 sm:w-11">
                    {selected?.image ? (
                        <Image src={selected.image} alt="" fill sizes="44px" className="object-contain" />
                    ) : (
                        <span className="flex h-full items-center justify-center text-sm font-bold text-[#d77465]">R</span>
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-semibold uppercase text-[#9a6b62] sm:text-[11px]">
                        {selected?.brand_name || 'Select brand'}
                    </span>
                    <span className="block truncate text-xs font-medium text-gray-800 sm:text-sm">
                        {selected?.product_name || 'Select product'}
                    </span>
                </span>
                <FiChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open ? (
                <div role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto border border-gray-200 bg-white py-1 shadow-xl">
                    {products.map((product) => {
                        const disabled = product.product_uid === disabledId
                        const active = product.product_uid === selectedId
                        return (
                            <button
                                key={product.product_uid}
                                type="button"
                                role="option"
                                aria-selected={active}
                                disabled={disabled}
                                onClick={() => {
                                    onChange(product.product_uid)
                                    setOpen(false)
                                }}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                    active ? 'bg-[#f8eeeb]' : 'hover:bg-[#faf8f6]'
                                } disabled:cursor-not-allowed disabled:opacity-35`}
                            >
                                <span className="relative h-10 w-10 shrink-0 bg-white">
                                    {product.image ? (
                                        <Image src={product.image} alt="" fill sizes="40px" className="object-contain" />
                                    ) : (
                                        <span className="flex h-full items-center justify-center text-xs font-bold text-[#d77465]">R</span>
                                    )}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[10px] font-semibold uppercase text-[#9a6b62]">{product.brand_name}</span>
                                    <span className="block text-[13px] font-medium leading-snug text-gray-800 sm:text-sm">{product.product_name}</span>
                                </span>
                                {active ? <FiCheck aria-hidden="true" className="shrink-0 text-[#c76557]" /> : null}
                            </button>
                        )
                    })}
                </div>
            ) : null}
        </div>
    )
}

function ProductSummary({ product, isWinner }) {
    return (
        <div className={`relative min-w-0 px-2 py-4 text-center sm:px-6 ${isWinner ? 'bg-[#f3f8f6]' : 'bg-white'}`}>
            {isWinner ? (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#d8e7e6] px-2 py-1 text-[9px] font-bold uppercase text-[#355d59] sm:right-3 sm:top-3">
                    <FiCheck aria-hidden="true" /> Better fit
                </span>
            ) : null}
            <div className="relative mx-auto mb-3 h-24 w-24 sm:h-32 sm:w-32">
                {product.image ? (
                    <Image
                        src={product.image}
                        alt={product.product_name}
                        fill
                        sizes="128px"
                        className="object-contain"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center bg-[#faf7f2] font-lato text-2xl font-semibold text-[#d77465]">R</div>
                )}
            </div>
            <p className="truncate text-[9px] font-semibold uppercase text-[#9a6b62] sm:text-[10px]">{product.brand_name}</p>
            <p className="product-name-clamp mx-auto mt-1 min-h-9 max-w-xs text-xs font-semibold leading-snug text-gray-800 sm:text-sm">
                {product.product_name}
            </p>
            <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className={`rounded-md px-3 py-1.5 text-xl font-bold leading-none sm:text-2xl ${scoreTone(Number(product.score))}`}>
                    {product.score}
                </span>
                <span className="text-[9px] font-semibold uppercase text-gray-400">match</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-700">{displayPrice(product)}</p>
        </div>
    )
}

export default function ProductPlayground({ products, quizAnswers, initialProductId = '' }) {
    const comparableProducts = useMemo(
        () => products.filter((product) => Number.isFinite(Number(product.score))),
        [products],
    )
    const [leftId, setLeftId] = useState('')
    const [rightId, setRightId] = useState('')

    const productsWithPeers = comparableProducts.filter((product) =>
        comparableProducts.some((candidate) =>
            candidate.product_uid !== product.product_uid
            && comparisonCategory(candidate) === comparisonCategory(product),
        ),
    )
    const preferredLeftId = leftId || initialProductId
    const selectedLeftId = productsWithPeers.some((product) => product.product_uid === preferredLeftId)
        ? preferredLeftId
        : productsWithPeers[0]?.product_uid || ''
    const left = comparableProducts.find((product) => product.product_uid === selectedLeftId)
    const sameCategoryProducts = comparableProducts.filter((product) =>
        comparisonCategory(product) === comparisonCategory(left),
    )
    const selectedRightId = sameCategoryProducts.some((product) => product.product_uid === rightId && product.product_uid !== selectedLeftId)
        ? rightId
        : sameCategoryProducts.find((product) => product.product_uid !== selectedLeftId)?.product_uid || ''
    const right = sameCategoryProducts.find((product) => product.product_uid === selectedRightId)

    if (productsWithPeers.length < 2) return null

    const leftWins = Number(left?.score) > Number(right?.score)
    const rightWins = Number(right?.score) > Number(left?.score)
    const winner = leftWins ? left : rightWins ? right : null
    const scoreGap = left && right ? Math.abs(Number(left.score) - Number(right.score)) : 0

    return (
        <section aria-labelledby="playground-title" className="mx-auto mt-8 max-w-5xl overflow-hidden border border-[#e7ded9] bg-[#f7f5f2] px-3 py-7 font-lato shadow-[0_8px_30px_rgba(70,55,50,0.06)] sm:px-7 sm:py-9">
            <div className="text-center">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ead8d3] bg-white text-[#c76557]">
                    <FiGitMerge aria-hidden="true" size={17} />
                </span>
                <h2 id="playground-title" className="mt-2 text-2xl font-semibold text-gray-900 sm:text-[28px]">
                    Product Playground
                </h2>
                <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-gray-500 sm:text-sm">
                    Pick two products to see which one fits your skin profile better, and why.
                </p>
            </div>

            <div className="relative mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-2 bg-white p-3 sm:gap-5 sm:p-5">
                <ProductPicker
                    label="Product one"
                    products={productsWithPeers}
                    selectedId={selectedLeftId}
                    disabledId={selectedRightId}
                    onChange={setLeftId}
                />
                <span className="mb-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#f8eeeb] text-[9px] font-bold uppercase text-[#c76557] sm:mb-4 sm:h-8 sm:w-8">vs</span>
                <ProductPicker
                    label="Product two"
                    products={sameCategoryProducts}
                    selectedId={selectedRightId}
                    disabledId={selectedLeftId}
                    onChange={setRightId}
                />
            </div>

            {left && right ? (
                <>
                    <p className="mt-5 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-[#9a6b62]">
                        Comparing {comparisonCategory(left)} products
                    </p>
                    <div className="relative mt-3 grid grid-cols-2 gap-px overflow-hidden border border-gray-200 bg-gray-200">
                        <ProductSummary product={left} isWinner={leftWins} />
                        <ProductSummary product={right} isWinner={rightWins} />
                    </div>

                    <div className="pt-5">
                        <p className="mx-auto max-w-2xl text-center text-lg font-semibold leading-snug text-gray-900 sm:text-xl">
                            {winner
                                ? `${winner.product_name} leads by ${scoreGap} points`
                                : 'Both products are an equal match'}
                        </p>
                        <div className="mx-auto mt-5 grid max-w-3xl grid-cols-[1fr_0.72fr_1fr] overflow-hidden border border-gray-200 bg-white text-[11px] sm:text-xs">
                            <IngredientComparison product={left} />
                            <p className="flex items-center justify-center border-x border-gray-200 bg-[#faf8f6] px-2 py-4 text-center font-bold text-gray-500 sm:px-4">Key ingredients</p>
                            <IngredientComparison product={right} />

                            <p className="border-t border-gray-200 px-2 py-4 text-center font-medium text-gray-700 sm:px-4">
                                {left.when_to_use || left.base_when_to_use || 'Follow product instructions'}
                            </p>
                            <p className="flex items-center justify-center border border-b-0 border-gray-200 bg-[#faf8f6] px-2 py-4 text-center font-bold text-gray-500 sm:px-4">When to use</p>
                            <p className="border-t border-gray-200 px-2 py-4 text-center font-medium text-gray-700 sm:px-4">
                                {right.when_to_use || right.base_when_to_use || 'Follow product instructions'}
                            </p>

                            <p className="border-t border-gray-200 px-2 py-4 text-center leading-5 text-gray-700 sm:px-4">
                                {suitability(left, quizAnswers?.skinType)}
                            </p>
                            <p className="flex items-center justify-center border border-b-0 border-gray-200 bg-[#faf8f6] px-2 py-4 text-center font-bold text-gray-500 sm:px-4">Skin suitability</p>
                            <p className="border-t border-gray-200 px-2 py-4 text-center leading-5 text-gray-700 sm:px-4">
                                {suitability(right, quizAnswers?.skinType)}
                            </p>
                        </div>
                        {winner ? (
                            <p className="mx-auto mt-4 flex max-w-2xl items-start gap-2 border-l-2 border-[#d77465] bg-white px-3 py-3 text-[11px] leading-5 text-gray-600 sm:text-xs">
                                <FiArrowRight aria-hidden="true" className="mt-1 shrink-0 text-[#c76557]" />
                                Roopsee compares only the score factors relevant to your quiz answers. A hard blocker always outweighs a high average.
                            </p>
                        ) : null}
                    </div>
                </>
            ) : null}
        </section>
    )
}
