import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CACHE_DURATION_MS = 10 * 60 * 1000;
const PAGE_SIZE = 1000;
let cachedFacets = null;
let cacheExpiresAt = 0;

function increment(map, value) {
  const label = typeof value === "string" ? value.trim() : "";
  if (label) map.set(label, (map.get(label) || 0) + 1);
}

function optionsFromMap(map) {
  return [...map.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

async function loadFacetRows() {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("retailer_products")
      .select("brand,categories,mrp,selling_price,rating,product_attributes")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function GET() {
  if (cachedFacets && Date.now() < cacheExpiresAt) {
    return NextResponse.json(cachedFacets);
  }

  try {
    const rows = await loadFacetRows();
    const brands = new Map();
    const categories = new Map();
    const countries = new Map();
    const priceCounts = { under_500: 0, "500_1000": 0, over_1000: 0 };
    const ratingCounts = { "4": 0, "3": 0 };

    rows.forEach((product) => {
      increment(brands, product.brand);
      (product.categories || []).forEach((category) => increment(categories, category));
      increment(countries, product.product_attributes?.["Country of origin"]);

      const price = Number(product.selling_price ?? product.mrp);
      if (Number.isFinite(price)) {
        if (price < 500) priceCounts.under_500 += 1;
        else if (price <= 1000) priceCounts["500_1000"] += 1;
        else priceCounts.over_1000 += 1;
      }

      const rating = Number(product.rating);
      if (Number.isFinite(rating)) {
        if (rating >= 4) ratingCounts["4"] += 1;
        if (rating >= 3) ratingCounts["3"] += 1;
      }
    });

    cachedFacets = {
      options: {
        brand: optionsFromMap(brands),
        price: [
          { value: "under_500", label: "Under ₹500", count: priceCounts.under_500 },
          { value: "500_1000", label: "₹500 – ₹1,000", count: priceCounts["500_1000"] },
          { value: "over_1000", label: "Over ₹1,000", count: priceCounts.over_1000 },
        ],
        category: optionsFromMap(categories),
        rating: [
          { value: "4", label: "4★ & above", count: ratingCounts["4"] },
          { value: "3", label: "3★ & above", count: ratingCounts["3"] },
        ],
        country: optionsFromMap(countries),
      },
      total: rows.length,
    };
    cacheExpiresAt = Date.now() + CACHE_DURATION_MS;

    return NextResponse.json(cachedFacets);
  } catch (error) {
    console.error("Failed to build retailer product filters:", error.message);
    return NextResponse.json(
      { error: "Unable to load filters right now." },
      { status: 500 },
    );
  }
}
