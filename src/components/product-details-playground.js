'use client'

import ProductPlayground from '@/components/homeComponents/ProductPlayground'
import { useScoredProducts } from '@/hooks/use-scored-products'

export default function ProductDetailsPlayground({ productUid }) {
    const { products, quizAnswers, loading, error } = useScoredProducts()

    if (loading || error || !quizAnswers) return null

    return (
        <ProductPlayground
            products={products}
            quizAnswers={quizAnswers}
            initialProductId={productUid}
        />
    )
}
