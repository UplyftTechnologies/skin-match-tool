import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PRODUCT_FIELDS = [
  "id",
  "site",
  "parent_product_id",
  "product_id",
  "sku",
  "categories",
  "brand",
  "product_name",
  "variant",
  "mrp",
  "selling_price",
  "discount_pct",
  "rating",
  "rating_count",
  "in_stock",
  "product_url",
  "image_url",
  "product_attributes",
  "updated_at",
].join(",");

function categoryCandidates(search) {
  const titleCase = search
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  const candidates = new Set([search, titleCase]);

  if (titleCase.endsWith("s")) {
    candidates.add(titleCase.slice(0, -1));
  } else {
    candidates.add(`${titleCase}s`);
  }

  return [...candidates].filter(Boolean);
}

function applyFilters(query, searchParams) {
  const brands = searchParams.getAll("brand").filter(Boolean);
  const categories = searchParams.getAll("category").filter(Boolean);
  const countries = searchParams.getAll("country").filter(Boolean);
  const priceRanges = searchParams.getAll("price").filter(Boolean);
  const ratings = searchParams
    .getAll("rating")
    .map(Number)
    .filter(Number.isFinite);

  if (brands.length) query = query.in("brand", brands);
  if (categories.length) query = query.overlaps("categories", categories);
  if (countries.length) {
    query = query.in("product_attributes->>Country of origin", countries);
  }
  if (ratings.length) query = query.gte("rating", Math.min(...ratings));

  const priceConditions = priceRanges
    .map((range) => {
      if (range === "under_500") {
        return [
          "selling_price.lt.500",
          "and(selling_price.is.null,mrp.lt.500)",
        ];
      }
      if (range === "500_1000") {
        return [
          "and(selling_price.gte.500,selling_price.lte.1000)",
          "and(selling_price.is.null,mrp.gte.500,mrp.lte.1000)",
        ];
      }
      if (range === "over_1000") {
        return [
          "selling_price.gt.1000",
          "and(selling_price.is.null,mrp.gt.1000)",
        ];
      }
      return [];
    })
    .flat()
    .filter(Boolean);
  if (priceConditions.length) query = query.or(priceConditions.join(","));

  return query;
}

function productQuery(limit, searchParams) {
  const query = supabaseAdmin
    .from("retailer_products")
    .select(PRODUCT_FIELDS)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return applyFilters(query, searchParams);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") || 100);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200)
    : 100;
  const search = (searchParams.get("search") || "")
    .replace(/[^\p{L}\p{N}\s&'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  if (!search) {
    const { data, error } = await productQuery(limit, searchParams);

    if (error) {
      console.error("Failed to fetch retailer products:", error.message);
      return NextResponse.json(
        { error: "Unable to load products right now." },
        { status: 500 },
      );
    }

    return NextResponse.json({ products: data || [] });
  }

  const [nameResult, brandResult, categoryResult] = await Promise.all([
    productQuery(limit, searchParams).ilike("product_name", `%${search}%`),
    productQuery(limit, searchParams).ilike("brand", `%${search}%`),
    productQuery(limit, searchParams).overlaps("categories", categoryCandidates(search)),
  ]);
  const failedResult = [nameResult, brandResult, categoryResult].find(
    (result) => result.error,
  );

  if (failedResult) {
    console.error("Failed to search retailer products:", failedResult.error.message);
    return NextResponse.json(
      { error: "Unable to search products right now." },
      { status: 500 },
    );
  }

  const productsById = new Map();
  [...nameResult.data, ...brandResult.data, ...categoryResult.data].forEach(
    (product) => productsById.set(product.id, product),
  );
  const products = [...productsById.values()]
    .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at))
    .slice(0, limit);

  return NextResponse.json({ products });
}
