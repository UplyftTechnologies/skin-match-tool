import { loadProducts } from '@/lib/data'

export const runtime = 'nodejs'

export async function GET() {
    try {
        const products = await loadProducts()
        return Response.json({
            products: products.map(({ scores, ...product }) => ({
                ...product,
                selling_price: product.sp,
                size: product.sku_size,
            })),
        })
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 })
    }
}
