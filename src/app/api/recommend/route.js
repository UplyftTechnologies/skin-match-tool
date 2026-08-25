import { recommend } from "@/lib/engine";

export const runtime = "nodejs";

function recommendationListItem(product) {
  return {
    product_uid: product.product_uid,
    product_name: product.product_name,
    brand_name: product.brand_name,
    category: product.category,
    product_type: product.product_type,
    score: product.score,
    match_label: product.match_label,
    source_sheet: product.source_sheet,
    size: product.size,
    mrp: product.mrp,
    selling_price: product.selling_price,
    when_to_use: product.when_to_use,
    image: product.image,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const searchParams = new URL(request.url).searchParams;
    const limit = searchParams.get("limit") || body.limit || 24;
    const response = await recommend(body, limit);
    const summary = searchParams.get("summary") === "1";
    return Response.json(
      summary
        ? { ...response, products: response.products.map(recommendationListItem) }
        : response,
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
