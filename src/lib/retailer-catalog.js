// Turns the raw `retailer_products` rows into a browsable catalogue.
//
// The table stores one row per retailer listing, so the same physical product
// appears up to six times (nykaa, tira, amazon, purplle, broadway, kindlife).
// Listing those as separate cards would make the grid look broken, so rows are
// collapsed to one card per product and the cheapest offer is what we show.
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { detectRestrictedActives } from "@/lib/scoring/ingredient-safety";
import { listingSize, variantBaseKey } from "@/lib/variant-sizes";
import { isMultipack } from "@/lib/retailer-match";

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
  "ingredients",
  "product_attributes",
  "key_ingredients",
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

function normalizeGtin(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

// Temporary editorial gate: the public catalogue lists only products both
// of these retailers stock, so every card can show a real price comparison.
export const TARGET_RETAILERS = ["nykaa", "tira"];

function isAvailableOnBothTargetRetailers(group) {
  const gtins = group
    .map((row) => normalizeGtin(row.gtin))
    .filter(Boolean);
  if (!gtins.length) return false;

  const sites = new Set(
    group
      .filter((row) => normalizeGtin(row.gtin))
      .map((row) => normalizeKey(row.site)),
  );
  return TARGET_RETAILERS.every((site) => sites.has(site));
}

// A GTIN is the same physical product everywhere; name fallback is retained
// only for internal grouping because public catalogue entries require a GTIN.
function dedupeKey(row) {
  const gtin = normalizeGtin(row.gtin);
  if (gtin) return `g:${gtin}`;
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

// Retailers scrape their own spec tables into `product_attributes`, so the
// key casing and wording drift ("Skin type" vs "Skin Type") and any one
// listing may have scraped nothing at all. Scanning every sibling listing in
// the family for the first retailer that *did* capture the field finds real
// data far more often than trusting whichever row happens to be primary.
function pickListedAttribute(rows, keyNames) {
  const wanted = new Set(keyNames.map((name) => name.toLowerCase()));
  for (const row of rows) {
    const attributes = row?.product_attributes || {};
    for (const [key, value] of Object.entries(attributes)) {
      if (!wanted.has(key.trim().toLowerCase())) continue;
      const formatted = Array.isArray(value) ? value.join(", ") : String(value || "").trim();
      if (formatted) return formatted;
    }
  }
  return "";
}

// Shared by the retailer product page's price-compare panel and the Product
// Playground comparison table, so both read the same facts the same way.
export function deriveSkinFacts(rows, categoryRow) {
  const skinType = pickListedAttribute(rows, ["skin type"]);
  const concern = pickListedAttribute(rows, ["concern", "skin concern"]);
  const activeIngredient =
    pickListedAttribute(rows, ["active ingredients", "active ingredient"]) ||
    rows.find((row) => row?.key_ingredients?.length)?.key_ingredients?.join(", ") ||
    "";
  const hasIngredientList = rows.some((row) => Boolean(row?.ingredients));
  const sensitivity = skinType.toLowerCase().includes("sensitive")
    ? "Suitable for sensitive skin"
    : "";
  const suitableFor = [skinType, concern].filter(Boolean).join(" · ");

  return {
    baseType: categoryRow ? canonicalCategory(categoryRow) : "",
    skinType,
    concern,
    activeIngredient,
    sensitivity,
    suitableFor,
    hasIngredientList,
  };
}

function toCard(primary, group) {
  const prices = group.map(priceOf).filter((value) => value !== null);
  const rated = group.filter((row) => Number(row.rating) > 0);
  const bestRated = rated.sort(
    (left, right) => Number(right.rating_count || 0) - Number(left.rating_count || 0),
  )[0];

  // Screened here, while the raw ingredient text is still in hand — the card
  // does not carry it, and re-fetching 19k ingredient lists per request to
  // re-derive this would be absurd. Only the rule ids survive.
  const restricted = [
    ...new Set(
      group.flatMap((row) => detectRestrictedActives(row).map((rule) => rule.id)),
    ),
  ];
  const skinFacts = deriveSkinFacts(group, primary);

  return {
    product_uid: String(primary.id),
    restricted,
    product_name: primary.product_name,
    brand_name: primary.brand,
    category: canonicalCategory(primary),
    product_type: canonicalCategory(primary),
    size: listingSize(primary) || primary.variant || "",
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
    gtin: normalizeGtin(primary.gtin),
    skin_type: skinFacts.skinType,
    concern: skinFacts.concern,
    active_ingredient: skinFacts.activeIngredient,
    sensitivity: skinFacts.sensitivity,
    suitable_for: skinFacts.suitableFor,
    has_ingredient_list: skinFacts.hasIngredientList,
    ingredient_cautions: restricted
      .map((item) => String(item).replace(/[_-]+/g, " "))
      .join(", "),
  };
}



// Removes a trailing size from a product name: "... Toning Lotion (100ml)"
// becomes "... Toning Lotion". Only at the end, and only when something is
// left over — a name that is nothing but a size stays as it was.
function stripTrailingSize(name) {
  const stripped = String(name || "")
    .replace(/[\s\-–—]*[([]?\s*\d+(?:\.\d+)?\s*(?:fl\s*oz|ml|gms|gm|kg|oz|g|l)\s*[)\]]?\s*$/i, "")
    .trim();
  return stripped || String(name || "");
}

// One card per product line, not one per size.
//
// The detail page now offers the sizes as a selector, so listing the 100ml
// and 200ml of the same toner as separate cards just repeats the product.
// Multipacks stay separate: a 2-pack is a different purchase, not a size.
//
// The representative is the card with the widest retailer coverage first, so
// collapsing can never hide a family behind a size that only one retailer
// stocks; ratings and then price break the remaining ties.
function collapseSizeVariants(cards) {
  const families = new Map();

  for (const card of cards) {
    const key = isMultipack(card) ? null : variantBaseKey(card);
    if (!key) {
      families.set(`solo:${card.product_uid}`, [card]);
      continue;
    }
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(card);
  }

  return [...families.values()].map((family) => {
    if (family.length === 1) return family[0];

    const ranked = [...family].sort(
      (left, right) =>
        right.sites.length - left.sites.length ||
        (right.rating_count || 0) - (left.rating_count || 0) ||
        (left.selling_price ?? Infinity) - (right.selling_price ?? Infinity),
    );
    const prices = family.map((item) => item.mrp).filter((n) => Number.isFinite(n));

    return {
      ...ranked[0],
      // The representative's name still names its own size — "(50ml)" beside
      // a "2 sizes" label contradicts itself, so the trailing quantity is
      // dropped once the card stands for a range.
      product_name: stripTrailingSize(ranked[0].product_name),
      // Rendered as "3 sizes · from ₹349" so the card says a range exists
      // rather than presenting one size's price as the product's price.
      size_count: family.length,
      from_price: prices.length ? Math.min(...prices) : null,
      sizes_available: family
        .map((item) => listingSize(item))
        .filter(Boolean)
        .sort((a, b) => parseFloat(a) - parseFloat(b)),
    };
  });
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
let refreshPromise = null;

async function buildRetailerCatalog() {
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

    // The both-retailers rule is FLAGGED here, not applied. This catalogue is
    // shared: the browse listing wants only products it can price-compare, but
    // visual search must be able to find anything the shopper photographs.
    // Filtering here removed 86% of products from search, so a photo of a
    // Nykaa-only product returned the nearest surviving lookalike instead of
    // nothing. Each consumer now applies the rule, or ignores it.
    const products = [];
    for (const group of groups.values()) {
      let primary = null;
      for (const row of group) if (isBetterOffer(row, primary)) primary = row;
      if (!primary) continue;
      products.push({
        ...toCard(primary, group),
        on_target_retailers: isAvailableOnBothTargetRetailers(group),
      });
    }

    // Collapse once and serve the same array the cache holds. Returning the
    // pre-collapse `products` here meant the first request after every cache
    // expiry got duplicate size cards while every later one got the collapsed
    // list.
    const collapsed = collapseSizeVariants(products);
    cache = { products: collapsed, builtAt: Date.now() };
    return collapsed;
  } catch (error) {
    // A refresh failure should not blank the listing — keep serving the last
    // good catalogue and let the next request try again.
    if (cache) return cache.products;
    throw error;
  }
}

const loadPersistedRetailerCatalog = unstable_cache(
  buildRetailerCatalog,
  ["retailer-catalog-v2-comparison-fields"],
  { revalidate: CACHE_TTL_MS / 1000 },
);

/**
 * Populates the in-process cache without going through unstable_cache.
 *
 * unstable_cache needs Next's request-scoped incremental cache, which does
 * not exist during instrumentation.register() — calling loadRetailerCatalog()
 * there throws "Invariant: incrementalCache missing". Building directly fills
 * the module-scope cache that buildRetailerCatalog checks first, so the first
 * real request still returns immediately.
 */
export function warmRetailerCatalog() {
  return buildRetailerCatalog();
}

export function loadRetailerCatalog() {
  // Cache misses can arrive concurrently (for example, a page render and its
  // client request). Share the one persisted-cache lookup/rebuild per process.
  if (!refreshPromise) {
    refreshPromise = loadPersistedRetailerCatalog().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
