import { NextResponse } from "next/server";
import { loadRetailerCatalog, TARGET_RETAILERS } from "@/lib/retailer-catalog";
import { attachScores } from "@/lib/scoring/catalog-scores";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;


const PRICE_BUCKETS = [
  { value: "under_500", label: "Under ₹500", test: (price) => price !== null && price < 500 },
  {
    value: "500_1000",
    label: "₹500–₹1,000",
    test: (price) => price !== null && price >= 500 && price <= 1000,
  },
  { value: "over_1000", label: "Over ₹1,000", test: (price) => price !== null && price > 1000 },
];

function priceOf(product) {
  const value = Number(product.selling_price ?? product.mrp);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// `pick` may return a single value or a list — a product stocked on three
// sites has to count once against each of them, matching how the site filter
// tests membership rather than the primary offer alone.
function countBy(products, pick) {
  const counts = new Map();
  for (const product of products) {
    const picked = pick(product);
    for (const value of Array.isArray(picked) ? picked : [picked]) {
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, label: value, count }));
}

function matchesSearch(product, query) {
  if (!query) return true;
  return [product.product_name, product.brand_name, product.category].some((value) =>
    value?.toLowerCase().includes(query),
  );
}

// Facet counts are built from the products matching every OTHER filter, so a
// count never reads as zero for something the shopper can actually still pick.
function applyFilters(products, filters, { except } = {}) {
  return products.filter((product) => {
    // The editorial both-retailers rule. Applied here rather than in the
    // shared catalogue loader, so visual search can still find products this
    // listing chooses not to show. Never exempted by `except`: it defines the
    // listing rather than narrowing it, so facet counts sit inside it too.
    if (!product.on_target_retailers) return false;
    if (!matchesSearch(product, filters.query)) return false;
    if (except !== "brand" && filters.brand.length && !filters.brand.includes(product.brand_name)) {
      return false;
    }
    if (
      except !== "category" &&
      filters.category.length &&
      !filters.category.includes(product.category)
    ) {
      return false;
    }
    if (except !== "site" && filters.site.length && !filters.site.some((site) => product.sites.includes(site))) {
      return false;
    }
    if (except !== "price" && filters.price.length) {
      const price = priceOf(product);
      const buckets = PRICE_BUCKETS.filter((bucket) => filters.price.includes(bucket.value));
      if (!buckets.some((bucket) => bucket.test(price))) return false;
    }
    return true;
  });
}

function sortProducts(products, sort) {
  const copy = [...products];
  const price = (product) => priceOf(product);

  if (sort === "price_asc") {
    return copy.sort((left, right) => (price(left) ?? Infinity) - (price(right) ?? Infinity));
  }
  if (sort === "price_desc") {
    return copy.sort((left, right) => (price(right) ?? -Infinity) - (price(left) ?? -Infinity));
  }
  if (sort === "discount") {
    return copy.sort((left, right) => (right.discount_pct || 0) - (left.discount_pct || 0));
  }
  if (sort === "name_asc") {
    return copy.sort((left, right) => left.product_name.localeCompare(right.product_name));
  }
  if (sort === "score_desc") {
    return copy.sort((left, right) => {
      const a = left.scoring;
      const b = right.scoring;
      // Unscored products sink below every scored one rather than being
      // treated as a zero, which would rank them alongside hard blocks.
      if (!a && !b) return weightedRating(right) - weightedRating(left);
      if (!a) return 1;
      if (!b) return -1;
      return b.score - a.score || a.rank - b.rank;
    });
  }
  return copy.sort((left, right) => weightedRating(right) - weightedRating(left));
}

// Raw rating puts every unreviewed 5.0 above a 4.6 with 8,000 reviews, which
// fills page one with obscure listings. Pull each rating toward the catalogue
// average in proportion to how little evidence backs it, so a product has to
// earn its place with volume as well as stars.
const RATING_PRIOR = 4.2;
const RATING_CONFIDENCE = 50;

function weightedRating(product) {
  const rating = Number(product.rating);
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  const count = Number(product.rating_count) || 0;
  return (
    (count * rating + RATING_CONFIDENCE * RATING_PRIOR) / (count + RATING_CONFIDENCE)
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const filters = {
    query: (searchParams.get("search") || "").trim().toLowerCase(),
    brand: searchParams.getAll("brand").filter(Boolean),
    category: searchParams.getAll("category").filter(Boolean),
    site: searchParams.getAll("site").filter(Boolean),
    price: searchParams.getAll("price").filter(Boolean),
  };
  // The skin-match score is profile-dependent, so the quiz answers travel with
  // the request. Absent them the catalogue is served unscored rather than
  // scored against a default profile nobody chose.
  const skinType = searchParams.get("skinType");
  const profile = skinType
    ? {
        skinType,
        sensitive: searchParams.get("sensitive") === "1",
        age: searchParams.get("age") || "Adult",
        concern: searchParams.get("concern") || "None",
        specialConditions: searchParams.getAll("condition").filter(Boolean).length
          ? searchParams.getAll("condition").filter(Boolean)
          : ["None"],
      }
    : null;

  const sort = searchParams.get("sort") || "rating";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  let catalog;
  try {
    catalog = await loadRetailerCatalog();
  } catch (error) {
    console.error("Failed to load retailer catalog:", error.message);
    return NextResponse.json({ error: "Unable to load products right now." }, { status: 500 });
  }

  const matching = applyFilters(catalog, filters);
  // Scores must be attached BEFORE sorting when sorting by score, since a
  // product's score is not a property of the catalogue row.
  const scored = sort === "score_desc" ? attachScores(matching, profile) : matching;
  const sorted = sortProducts(scored, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const forBrand = applyFilters(catalog, filters, { except: "brand" });
  const forCategory = applyFilters(catalog, filters, { except: "category" });
  const forSite = applyFilters(catalog, filters, { except: "site" });
  const forPrice = applyFilters(catalog, filters, { except: "price" });

  return NextResponse.json({
    products: attachScores(sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), profile),
    scored: Boolean(profile),
    total: sorted.length,
    catalogTotal: catalog.length,
    requiredSites: TARGET_RETAILERS,
    page: safePage,
    totalPages,
    pageSize: PAGE_SIZE,
    facets: {
      brand: countBy(forBrand, (product) => product.brand_name),
      category: countBy(forCategory, (product) => product.category),
      site: countBy(forSite, (product) => product.sites),
      price: PRICE_BUCKETS.map((bucket) => ({
        value: bucket.value,
        label: bucket.label,
        count: forPrice.filter((product) => bucket.test(priceOf(product))).length,
      })),
    },
  });
}
