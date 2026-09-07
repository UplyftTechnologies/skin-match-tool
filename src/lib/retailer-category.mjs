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

  // A broad breadcrumb such as "Serums & Oils" must not override the
  // actual form named on the product. Check names before retailer tags.
  const nameRules = [
    ["Kits & Combos", /\b(?:kits?|combos?|sets?|bundles?)\b/i],
    ["Hair Care", /\bhair\b|\bshampoo\b|\bconditioner\b/i],
    ["Eye Care", /\b(?:eye|under[ -]?eye)\s+(?:care|cream|serum|gel|mask)\b/i],
    ["Lip Care", /\blip\s+(?:care|balm|mask|scrub|oil|serum)\b/i],
    ["Body Care", /\bbody\s+(?:care|lotion|wash|cream|oil|serum)\b/i],
    ["Cleanser", /\bcleansing\s+oil\b/i],
    ["Face Oil", /\b(?:face|facial|hydrating|nourishing)\s+oils?\b/i],
    ...CATEGORY_RULES.filter(([label]) => label !== "Treatment"),
    ["Moisturizer", BARE_CREAM_PATTERN],
  ];
  let matched = nameRules.find(([, pattern]) => pattern.test(nameText))?.[0] || "Other";
  if (matched === "Other") {
    for (const [label, pattern] of CATEGORY_RULES) {
      if (pattern.test(haystack)) {
        matched = label;
        break;
      }
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

