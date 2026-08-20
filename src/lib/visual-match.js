// Ranks catalog products against the attributes read off a photographed
// package. Kept separate from the API route so it can be exercised without a
// network call, and so the rules stay next to the price-comparison matcher
// whose behaviour they deliberately mirror.
import { nameSimilarity, normalize, strengths, sizes } from "@/lib/retailer-match";

export const MATCH_FLOOR = 0.45;

// roopsee_products stores concentrations two different ways: 61 names keep the
// sign ("Minimalist Niacinamide 5% Body Lotion") and 61 have had it stripped
// ("The Derma Co 2 Salicylic Acid Face Wash" is 2%). strengths() only sees the
// first kind, so on the second the strength check would pass vacuously and let
// a 2% pack match a 10% product. Recover the bare form, but only directly in
// front of a known active — that keeps "SPF 30", "24H" and "5 Essential
// Ceramides" from being read as concentrations.
const ACTIVES = [
  "salicylic", "lactic", "glycolic", "mandelic", "kojic", "azelaic", "niacinamide",
  "retinol", "retinal", "retinoid", "hyaluronic", "ascorbic", "arbutin", "tranexamic",
  "benzoyl", "adapalene", "thiamidol", "urea", "aha", "bha", "lha", "pha", "vitamin",
].join("|");
// Both word orders occur: "2 Salicylic Acid" and "Retinol 0.3". A trailing
// unit means it was a volume, not a concentration.
// "AHA-BHA-PHA 30 Days Miracle Serum" is a duration, not a 30% product.
const NOT_A_UNIT =
  "(?!\\s*(?:ml|l|g|gm|gms|kg|oz|hour|hours|hr|hrs|h|day|days|week|weeks|night|nights|min|mins)\\b)";
// A concentration may carry a modifier before the active it belongs to,
// as in "2 Alpha Arbutin" or "1 Granactive Retinoid".
const MODIFIER = "(?:alpha|beta|poly|pure|active|encapsulated|granactive|l)\\s+";
const BEFORE_ACTIVE = new RegExp(
  `(?:^|[^a-z0-9.])(\\d+(?:\\.\\d+)?)\\s+(?:${MODIFIER})?(?=(?:${ACTIVES})\\b)`,
  "gi",
);
const AFTER_ACTIVE = new RegExp(
  `\\b(?:${ACTIVES})(?:\\s+(?:acid|complex|c|a|e))?\\s+(\\d+(?:\\.\\d+)?)\\b${NOT_A_UNIT}`,
  "gi",
);

export function catalogStrengths(name) {
  const stated = strengths(name);
  if (stated.length) return stated;

  // Drop SPF and net-quantity figures before looking for a bare concentration.
  const text = String(name || "")
    .toLowerCase()
    .replace(/\bspf\s*\d+(?:\.\d+)?\+?/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|l|g|gm|gms|kg|oz)\b/g, " ");

  const found = [
    ...[...text.matchAll(BEFORE_ACTIVE)].map((match) => Number(match[1])),
    ...[...text.matchAll(AFTER_ACTIVE)].map((match) => Number(match[1])),
  ];
  return [...new Set(found.filter(Number.isFinite))].sort((a, b) => a - b);
}

// Brand dominates, a stated strength that contradicts is fatal, and name
// similarity breaks the remaining ties — the same priority order the price
// matcher uses, for the same reason: showing the wrong concentration is worse
// than showing nothing.
export function scoreProduct(product, extracted) {
  const wantBrand = normalize(extracted?.brand);
  const haveBrand = normalize(product.brand_name);
  if (!wantBrand || !haveBrand) return 0;

  const brandExact = wantBrand === haveBrand;
  // Catalog brands are sometimes legal entities ("Dot & Key Wellness Limited")
  // while a package prints the trading name, so allow containment either way.
  const brandPartial =
    !brandExact &&
    (haveBrand.includes(wantBrand) || wantBrand.includes(haveBrand)) &&
    Math.min(wantBrand.length, haveBrand.length) >= 4;
  if (!brandExact && !brandPartial) return 0;

  const readName = [extracted.product_name, extracted.product_type, extracted.visible_text]
    .filter(Boolean)
    .join(" ");
  const similarity = nameSimilarity(readName, product.product_name);

  const readStrength = strengths(`${extracted.strength || ""} ${extracted.product_name || ""}`);
  const catalogStrength = catalogStrengths(product.product_name);
  if (readStrength.length && catalogStrength.length) {
    if (!readStrength.some((value) => catalogStrength.includes(value))) return 0;
  }

  const readSize = sizes(extracted.size);
  const catalogSize = sizes(`${product.product_name} ${product.sku_size || ""}`);
  const sizeBonus =
    readSize.length && catalogSize.length && readSize.some((item) => catalogSize.includes(item))
      ? 0.15
      : 0;
  const strengthBonus = readStrength.length && catalogStrength.length ? 0.15 : 0;

  return (brandExact ? 0.45 : 0.25) + similarity * 0.6 + sizeBonus + strengthBonus;
}

export function rankCatalogMatches(products, extracted, limit = 12) {
  return products
    .map((product) => ({ product, score: scoreProduct(product, extracted) }))
    .filter((entry) => entry.score > MATCH_FLOOR)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Browser-OCR path
//
// Tesseract returns everything it can see on the pack — claims, ingredient
// lists, "REDNESS REDUCED BY 4.89%" — not a tidy product name. Jaccard
// similarity divides by the union, so that noise would sink a correct product
// below the floor. Coverage of the *catalog* name is the right metric here:
// it asks how much of our product name appears on the pack and ignores
// whatever else Tesseract picked up.
// ---------------------------------------------------------------------------

const OCR_STOP_WORDS = new Set([
  "for", "with", "and", "the", "new", "pack", "combo", "free", "skin", "face",
  "care", "beauty", "product", "net", "wt", "vol", "made", "india", "korea",
  "dermatologically", "tested", "clinically", "proven", "all", "types", "use",
]);

function meaningfulTokens(text) {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((token) => token.length > 2 && !OCR_STOP_WORDS.has(token)),
  );
}

// Finds which catalog brand the scanned text belongs to. Longest match wins so
// "Dot & Key" is not beaten by a stray "Key", and the brand is required — an
// unbranded blob of text is not something we will guess a product from.
export function detectBrand(text, products) {
  const haystack = ` ${normalize(text)} `;
  let best = "";
  for (const product of products) {
    const brand = normalize(product.brand_name);
    if (!brand || brand.length < 3) continue;
    if (brand.length <= best.length) continue;
    if (haystack.includes(` ${brand} `) || haystack.includes(` ${brand}`)) best = brand;
  }
  if (!best) return "";
  const source = products.find((product) => normalize(product.brand_name) === best);
  return source ? source.brand_name : "";
}

export function scoreProductFromText(product, text, brand) {
  const wantBrand = normalize(brand);
  const haveBrand = normalize(product.brand_name);
  if (!wantBrand || wantBrand !== haveBrand) return 0;

  const scanned = meaningfulTokens(text);
  const brandTokens = meaningfulTokens(product.brand_name);
  // Every product of this brand shares the brand words, so they carry no
  // signal about which product it is.
  const wanted = [...meaningfulTokens(product.product_name)].filter(
    (token) => !brandTokens.has(token),
  );
  if (!wanted.length || !scanned.size) return 0;

  const shared = wanted.filter((token) => scanned.has(token)).length;
  const coverage = shared / wanted.length;
  // One shared word is almost always something generic like "serum", which
  // every product of the brand would also match. Ask for two before believing
  // it, unless the product name is genuinely that short.
  if (shared < Math.min(2, wanted.length)) return 0;

  const readStrength = strengths(text);
  const catalogStrength = catalogStrengths(product.product_name);
  if (readStrength.length && catalogStrength.length) {
    if (!readStrength.some((value) => catalogStrength.includes(value))) return 0;
  }

  // Size and strength agreement confirm a name that already looks right; they
  // must never lift a weak name match on their own, or every 30ml serum of the
  // brand would clear the floor on the word "serum" alone.
  const confirming = coverage >= 0.5;
  const readSize = sizes(text);
  const catalogSize = sizes(`${product.product_name} ${product.sku_size || ""}`);
  const sizeBonus =
    confirming &&
    readSize.length &&
    catalogSize.length &&
    readSize.some((item) => catalogSize.includes(item))
      ? 0.15
      : 0;
  const strengthBonus = confirming && readStrength.length && catalogStrength.length ? 0.15 : 0;

  return 0.35 + coverage * 0.6 + sizeBonus + strengthBonus;
}

// Brand names are set in stylised logos — exactly the text OCR reads worst.
// "Chemist at Play" comes back as "Corr Li chon adploy" while BRIGHT BOOST,
// BODY LOTION and 5% Niacinamide all read perfectly. Measured over 98 real
// packshots, requiring a brand threw away half the products OCR had already
// identified, so an unreadable logo falls back to matching on the product
// words alone — at a much higher bar, since there is no brand to anchor it.
// Scored on the *mass of distinctive evidence*, not the fraction of the name
// matched. Fraction-of-name quietly favours short names: a photo of the Chemist
// at Play "Bright Boost SPF Body Lotion" matched "Minimalist Niacinamide 5%
// Body Lotion" better, because three generic words are most of a short name and
// a quarter of a long one. Weighting each word by how rare it is in the
// catalogue fixes that — "boost" is near-unique and decisive, "lotion" is
// almost worthless.
const BRANDLESS_MIN_MASS = 10;
const BRANDLESS_MIN_SHARED = 3;

// Document frequencies depend only on the catalogue, so they are computed once
// per product list rather than on every photo.
const idfCache = new WeakMap();

function inverseDocumentFrequency(products) {
  const cached = idfCache.get(products);
  if (cached) return cached;

  const frequency = new Map();
  for (const product of products) {
    for (const token of meaningfulTokens(`${product.brand_name} ${product.product_name}`)) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }
  }
  const total = products.length;
  const weight = (token) => Math.log(total / ((frequency.get(token) || 0) + 1));
  idfCache.set(products, weight);
  return weight;
}

function rankWithoutBrand(products, text, limit) {
  const scanned = meaningfulTokens(text);
  if (!scanned.size) return [];
  const weight = inverseDocumentFrequency(products);

  return products
    .map((product) => {
      // Brand words stay in play — a half-read logo still leaves usable letters.
      const wanted = [...meaningfulTokens(`${product.brand_name} ${product.product_name}`)];
      const hits = wanted.filter((token) => scanned.has(token));
      const mass = hits.reduce((total, token) => total + weight(token), 0);
      return { product, score: mass, shared: hits.length };
    })
    .filter(
      (entry) => entry.score >= BRANDLESS_MIN_MASS && entry.shared >= BRANDLESS_MIN_SHARED,
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function rankCatalogMatchesFromText(products, text, limit = 12) {
  const brand = detectBrand(text, products);

  if (brand) {
    const matches = products
      .map((product) => ({ product, score: scoreProductFromText(product, text, brand) }))
      .filter((entry) => entry.score > MATCH_FLOOR)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
    if (matches.length) return { brand, matches, confident: true };
  }

  // Either no brand was read, or the brand read but matched nothing under it.
  return { brand, matches: rankWithoutBrand(products, text, limit), confident: false };
}
