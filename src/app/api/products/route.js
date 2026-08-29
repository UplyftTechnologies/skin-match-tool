import { loadProducts } from '@/lib/data'

export const runtime = 'nodejs'

function productListItem(product) {
    return {
        product_uid: product.product_uid,
        product_name: product.product_name,
        brand_name: product.brand_name,
        category: product.category,
        product_type: product.product_type,
        sku_size: product.sku_size,
        size: product.sku_size,
        mrp: product.mrp,
        sp: product.sp,
        selling_price: product.sp,
        when_to_use: product.when_to_use,
        image: product.image,
    }
}

export async function GET(request) {
    try {
        const products = await loadProducts()
        const summary = new URL(request.url).searchParams.get('summary') === '1'
        return Response.json({
            // Card-only screens do not need ingredient text, long descriptions
            // or the raw scoring matrix for every catalog product.
            products: summary
                ? products.map(productListItem)
                : products.map(({ scores, ...product }) => ({
                    ...product,
                    selling_price: product.sp,
                    size: product.sku_size,
                })),
        })
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 })
    }
}
