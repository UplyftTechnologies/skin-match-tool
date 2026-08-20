// Turns the raw `retailer_products` rows into a browsable catalogue.
//
// The table stores one row per retailer listing, so the same physical product
// appears up to six times (nykaa, tira, amazon, purplle, broadway, kindlife).
// Listing those as separate cards would make the grid look broken, so rows are
// collapsed to one card per product and the cheapest offer is what we show.
import { supabaseAdmin } from "@/lib/supabase/server";

const CATALOG_FIELDS = [
  "id",
  "site",
  "brand",
  "product_name",
  "variant",
  "categories",
  "mrp",
  "selling_price",
  "discount_pct",
  "rating",
  "rating_count",
  "in_stock",
  "product_url",
  "image_url",
  "gtin",
].join(",");

const PAGE_SIZE = 1000;

// Each retailer ships its own taxonomy — "Moisturizers", "Moisturizer" and
// "Face Moisturizer and Day Cream" are the same shelf. Without this the
// category facet is 200 near-duplicate entries and useless to a shopper.
const CATEGORY_RULES = [
  ["Sunscreen", /sun\s*care|sunscreen|spf|sun\s*block/i],
  ["Serum", /serum|ampoule|essence|booster/i],
  ["Moisturizer", /moisturi[sz]|day cream|night cream|face cream|gel cream|emulsion/i],
  ["Cleanser", /cleanser|face wash|facewash|cleansing|micellar|makeup remover/i],
  ["Toner", /toner|mist/i],
  ["Mask", /mask|sheet mask|peel off/i],
  ["Eye Care", /eye care|eye cream|under eye|eye serum/i],
  ["Lip Care", /lip care|lip balm|lip mask|lip scrub/i],
  ["Exfoliator", /exfoliat|scrub|peel/i],
  ["Body Care", /body care|bath and body|body lotion|body wash|hands & feet|hand cream/i],
  ["Hair Care", /hair care|shampoo|conditioner|hair oil|hair serum/i],
  ["Kits & Combos", /kit|combo|set\b|bundle|gift/i],
  ["Treatment", /specialised skincare|treatment|acne|pigmentation|anti.?ageing|anti.?aging/i],
];

export function canonicalCategory(row) {
  const haystack = [
    ...(Array.isArray(row.categories) ? row.categories : []),
    row.product_name || "",
    row.variant || "",
  ].join(" ");

  for (const [label, pattern] of CATEGORY_RULES) {
    if (pattern.test(haystack)) return label;
  }
  return "Other";
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// A GTIN is the same physical product everywhere; without one, fall back to
// brand plus a trimmed name, which is where near-duplicates can still slip
// through — acceptable for a listing, and never used for pricing decisions.
function dedupeKey(row) {
  if (row.gtin) return `g:${row.gtin}`;
  return `n:${normalizeKey(row.brand)}|${normalizeKey(row.product_name).slice(0, 60)}`;
}

function priceOf(row) {
  const value = Number(row.selling_price ?? row.mrp);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Purplle lists cart freebies and sachet samples as ₹1 rows — tote bags, jute
// bags, 3ml sachets. They are not products anyone is shopping for, and sorting
// by price puts all 142 of them on page one, so they never enter the catalogue.
const GIVEAWAY = /\b(freebie|sampler|tote bag|jute bag|free gift|sample)\b/i;
const MIN_SELLABLE_PRICE = 20;

function isSellable(row) {
  if (GIVEAWAY.test(`${row.product_name} ${row.variant || ""}`)) return false;
  const price = priceOf(row);
  return price === null || price >= MIN_SELLABLE_PRICE;
}

// Prefer a cheap offer that is actually in stock; an out-of-stock row only
// wins when nothing else is available, and the card says so.
function isBetterOffer(candidate, current) {
  if (!current) return true;
  const candidatePrice = priceOf(candidate);
  const currentPrice = priceOf(current);
  if (candidate.in_stock !== current.in_stock) return candidate.in_stock === true;
  if (candidatePrice === null) return false;
  if (currentPrice === null) return true;
  return candidatePrice < currentPrice;
}

function toCard(primary, group) {
  const prices = group.map(priceOf).filter((value) => value !== null);
  const rated = group.filter((row) => Number(row.rating) > 0);
  const bestRated = rated.sort(
    (left, right) => Number(right.rating_count || 0) - Number(left.rating_count || 0),
  )[0];

  return {
    product_uid: String(primary.id),
    product_name: primary.product_name,
    brand_name: primary.brand,
    category: canonicalCategory(primary),
    site: primary.site,
    image: primary.image_url || "",
    product_url: primary.product_url || "",
    selling_price: priceOf(primary),
    mrp: Number(primary.mrp) || null,
    discount_pct: Number(primary.discount_pct) || null,
    rating: bestRated ? Number(bestRated.rating) : null,
    rating_count: bestRated ? Number(bestRated.rating_count) || null : null,
    in_stock: group.some((row) => row.in_stock === true),
    offer_count: group.length,
    sites: [...new Set(group.map((row) => row.site))],
    lowest_price: prices.length ? Math.min(...prices) : null,
  };
}

async function fetchActiveRows() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("retailer_products")
      .select(CATALOG_FIELDS)
      .eq("is_active", true)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load retailer_products: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Rebuilding the whole catalogue on every request would mean ~18k rows over the
// wire per page view, so it is held in module scope and refreshed on a timer.
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = null;

export async function loadRetailerCatalog() {
  if (cache && Date.now() - cache.builtAt < CACHE_TTL_MS) return cache.products;

  try {
    const rows = await fetchActiveRows();
    const groups = new Map();
    for (const row of rows) {
      if (!isSellable(row)) continue;
      const key = dedupeKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    const products = [];
    for (const group of groups.values()) {
      let primary = null;
      for (const row of group) if (isBetterOffer(row, primary)) primary = row;
      if (primary) products.push(toCard(primary, group));
    }

    cache = { products, builtAt: Date.now() };
    return products;
  } catch (error) {
    // A refresh failure should not blank the listing — keep serving the last
    // good catalogue and let the next request try again.
    if (cache) return cache.products;
    throw error;
  }
}
