// Turns the raw `retailer_products` rows into a browsable catalogue.
//
// The table stores one row per retailer listing, so the same physical product
// appears up to six times (nykaa, tira, amazon, purplle, broadway, kindlife).
// Listing those as separate cards would make the grid look broken, so rows are
// collapsed to one card per product and the cheapest offer is what we show.
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
  ["Body Care", /body care|bath and body|body lotion|body wash/i],
  ["Hair Care", /hair care|shampoo|conditioner|hair oil|hair serum/i],
  ["Kits & Combos", /kit|combo|set\b|bundle|gift/i],
  ["Treatment", /specialised skincare|treatment|acne|pigmentation|anti.?ageing|anti.?aging/i],
];

// A moisturizer-with-SPF ("Clinique Moisture Surge SPF 25", "CeraVe AM
// Facial Moisturizer With Sunscreen SPF 30", ...) matches the Sunscreen rule
// below purely because "SPF" appears in the title, which used to outrank
// Moisturizer on rule order alone — even though the retailer files these as
// Moisturizers. The retailer's own category is the more trustworthy signal
// for this one ambiguity: trust it when it unambiguously says Moisturizer and
// the listing is not also filed under Sun Care.
const RETAILER_CATEGORY_HINTS = {
  sunscreen: /sun\s*care|sunscreen|sun\s*block/i,
  moisturizer: /moisturi[sz]ers?/i,
};

// "Hands & Feet" is a broad retailer bucket that gets attached to loosely
// related products — a neck/face cream tagged "Hands & Feet, Neck Creams"
// with no hand or feet wording anywhere in its own name. Trusted only when
// the product's own name actually says hand/feet, not merely because the tag
// showed up somewhere in a retailer's breadcrumb.
const HAND_FEET_PATTERN = /hands? (&|and) feet|hand cream/i;

// A bare "Cream" with no day/night/face/gel qualifier ("Nourishing Rich
// Cream", "Barrier Cream") falls through every rule above and used to land
// on "Other" — this is the last-resort catch reached only when nothing more
// specific matched, so it can't steal a cleansing cream (Cleanser already
// claimed it) or a sunscreen cream (Sunscreen already claimed it) from a
// more specific bucket earlier in the list.
const BARE_CREAM_PATTERN = /\bcreams?\b/i;

// `siblingRows` are other retailers' listings of the same physical product
// (same GTIN) — the cheapest offer (whichever row `row` is) sometimes comes
// from a retailer whose own category is generic ("Personal Care") while a
// sibling listing has a clean "Moisturizers" tag for the identical item, so
// the disambiguation checks every listing of the product, not just this one.
export function canonicalCategory(row, siblingRows = []) {
  const nameText = [row.product_name || "", row.variant || ""].join(" ");
  const haystack = [...(Array.isArray(row.categories) ? row.categories : []), nameText].join(" ");

  if (HAND_FEET_PATTERN.test(nameText)) return "Body Care";

  let matched = "Other";
  for (const [label, pattern] of CATEGORY_RULES) {
    if (pattern.test(haystack)) {
      matched = label;
      break;
    }
  }

  if (matched === "Other" && BARE_CREAM_PATTERN.test(haystack)) {
    matched = "Moisturizer";
  }

  // Only the Sunscreen bucket is second-guessed — a mask, cleanser, serum,
  // etc. that happens to share a GTIN family with a "Moisturizers"-tagged
  // sibling must not be dragged into Moisturizer along with it.
  if (matched !== "Sunscreen") return matched;

  const retailerCategories = [row, ...siblingRows]
    .flatMap((entry) => (Array.isArray(entry?.categories) ? entry.categories : []))
    .join(" ");
  const isRetailerMoisturizer = RETAILER_CATEGORY_HINTS.moisturizer.test(retailerCategories);
  const isRetailerSunscreen = RETAILER_CATEGORY_HINTS.sunscreen.test(retailerCategories);
  return isRetailerMoisturizer && !isRetailerSunscreen ? "Moisturizer" : matched;
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
    baseType: categoryRow ? canonicalCategory(categoryRow, rows) : "",
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
    category: canonicalCategory(primary, group),
    product_type: canonicalCategory(primary, group),
    size: listingSize(primary) || primary.variant || "",
    site: primary.site,
    image: primary.image_url || "",
    product_url: primary.product_url || "",
    // Every retailer URL selling this same GTIN, primary included. The scored
    // dataset is a snapshot that covers Nykaa well but barely touches
    // Purplle/Amazon/Kindlife/Broadway/parts of Tira — when the primary
    // listing (the cheapest in-stock offer, not necessarily a covered
    // retailer) has no scoring data, attachScores() falls back through these
    // to a sibling listing of the identical physical product instead of
    // silently scoring the whole card null.
    alternate_urls: [...new Set(group.map((row) => row.product_url).filter(Boolean))],
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

// ~14-19k rows at PAGE_SIZE/page means 15-19 round trips to Supabase. Fetched
// one after another that was measured at 8-10s to build the catalogue — almost
// entirely network latency, not Postgres work, so firing every page at once
// cuts it to roughly the time of the single slowest page. `.order("id")` makes
// each page's `range()` window well-defined; offset pagination is only correct
// against a fixed sort, and running the pages concurrently instead of in
// sequence removed the accidental ordering that gave earlier code away with.
async function fetchActiveRows() {
  const { count, error: countError } = await supabaseAdmin
    .from("retailer_products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (countError) throw new Error(`Failed to count retailer_products: ${countError.message}`);

  const pageCount = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * PAGE_SIZE;
      return supabaseAdmin
        .from("retailer_products")
        .select(CATALOG_FIELDS)
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
    }),
  );

  const rows = [];
  for (const { data, error } of pages) {
    if (error) throw new Error(`Failed to load retailer_products: ${error.message}`);
    rows.push(...(data || []));
  }
  return rows;
}

// Rebuilding the whole catalogue on every request would mean ~18k rows over the
// wire per page view, so it is held in module scope and refreshed on a timer.
export const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_TTL_MS = CATALOG_CACHE_TTL_MS;
let cache = null;
let refreshPromise = null;

async function rebuildRetailerCatalog() {
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
}

async function buildRetailerCatalog() {
  if (cache && Date.now() - cache.builtAt < CACHE_TTL_MS) return cache.products;

  try {
    return await rebuildRetailerCatalog();
  } catch (error) {
    // A refresh failure should not blank the listing — keep serving the last
    // good catalogue and let the next request try again.
    if (cache) return cache.products;
    throw error;
  }
}

/**
 * Unconditionally rebuilds the catalogue, ignoring the current cache's age.
 *
 * Called on a timer from instrumentation.js, set just under CATALOG_CACHE_TTL_MS,
 * so the cache is refreshed in the background before it ever goes stale — the
 * live request that used to land right after expiry and pay the ~8-10s rebuild
 * cost no longer exists, because there is no window where the cache is stale.
 */
export async function refreshRetailerCatalogInBackground() {
  try {
    await rebuildRetailerCatalog();
  } catch (error) {
    // Keep serving whatever is cached; the next scheduled attempt tries again.
    console.error("[catalog-refresh] background rebuild failed:", error.message);
  }
}

/**
 * Populates the in-process cache.
 *
 * Exported separately from loadRetailerCatalog() only so
 * instrumentation.register() has an unambiguous name to call before any
 * request exists — both go through the same module-scope cache.
 */
export function warmRetailerCatalog() {
  return buildRetailerCatalog();
}

export function loadRetailerCatalog() {
  // Cache misses can arrive concurrently (for example, a page render and its
  // client request). Share the one rebuild per process rather than each
  // kicking off its own.
  if (!refreshPromise) {
    refreshPromise = buildRetailerCatalog().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
