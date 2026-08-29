'use client'

import ProductPlayground from '@/components/homeComponents/ProductPlayground'
import { useScoredProducts } from '@/hooks/use-scored-products'
import { scoredProductPath } from '@/lib/site'

export default function ProductDetailsPlayground({ productUid }) {
    const { products, quizAnswers, loading, error } = useScoredProducts()

    if (loading || error || !quizAnswers) return null

    return (
        <ProductPlayground
            products={products}
            quizAnswers={quizAnswers}
            initialProductId={productUid}
            linkBuilder={(item) => scoredProductPath(item.product_uid, item.score)}
        />
    )
}

