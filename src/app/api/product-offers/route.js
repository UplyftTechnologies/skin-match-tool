import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findProduct } from "@/lib/data";
import { loadRetailerCatalog } from "@/lib/retailer-catalog";
import { canonicalName, normalize } from "@/lib/retailer-match";

export const dynamic = "force-dynamic";

const OFFER_FIELDS = [
  "id",
  "site",
  "product_id",
  "brand",
  "product_name",
  "variant",
  "mrp",
  "selling_price",
  "discount_pct",
  "rating",
  "rating_count",
  "review_count",
  "in_stock",
  "product_url",
  "image_url",
  "image_urls",
  "description",
  "ingredients",
  "how_to_use",
  "key_features",
  "key_ingredients",
  "gtin",
].join(",");

// Pulling all 18k retailer rows per request would be wasteful, so narrow to the
// brand in SQL first. Brand spellings differ across retailers ("Dr. Sheth's" vs
// "Dr Sheths"), so match on the longest word rather than the whole string and
// let the strict matcher do the precise work in memory.
function brandSearchTerm(brandName) {
  const words = normalize(brandName)
    .split(" ")
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length >= 3);
  if (!words.length) return null;
  return words.reduce((longest, word) => (word.length > longest.length ? word : longest));
}

function priceOf(offer) {
  const value = Number(offer.selling_price ?? offer.mrp);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizedGtin(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function nameTokens(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2));
}

function catalogMatch(product, catalog) {
  const wanted = nameTokens(product.product_name);
  return catalog
    .filter((item) => normalize(item.brand_name) === normalize(product.brand_name) && item.gtin)
    .map((item) => {
      const candidate = nameTokens(item.product_name);
      const shared = [...wanted].filter((token) => candidate.has(token)).length;
      return { item, shared };
    })
    .sort((left, right) => right.shared - left.shared)[0]?.item || null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "A product uid is required." }, { status: 400 });
  }

  const product = await findProduct(uid);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const catalog = await loadRetailerCatalog();
  const matchedCatalogProduct = catalogMatch(product, catalog);
  const targetGtin = normalizedGtin(matchedCatalogProduct?.gtin);
  if (!targetGtin) {
    return NextResponse.json({ offers: [], matched: false });
  }

  const term = brandSearchTerm(product.brand_name);

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select(OFFER_FIELDS)
    .eq("is_active", true)
    .ilike("brand", `%${term}%`)
    .limit(2000);

  if (error) {
    console.error("Failed to load retailer offers:", error.message);
    return NextResponse.json(
      { error: "Unable to load retailer prices right now." },
      { status: 500 },
    );
  }

  const offersBySite = new Map();
  for (const offer of (data || [])
    .filter((offer) => normalizedGtin(offer.gtin) === targetGtin)
    .map((offer) => ({
      ...offer,
      price: priceOf(offer),
      // Amazon titles run to ~172 characters of marketing copy; show the name.
      product_name: canonicalName(offer.product_name),
      full_product_name: offer.product_name,
    }))
    .filter((offer) => offer.price !== null)) {
    const current = offersBySite.get(offer.site);
    if (!current || offer.price < current.price) offersBySite.set(offer.site, offer);
  }
  const offers = [...offersBySite.values()].sort((left, right) => left.price - right.price);

  return NextResponse.json({
    offers,
    matched: offers.length > 0,
    cheapest: offers[0]?.price ?? null,
  });
}
