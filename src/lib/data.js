import { roopseeAdmin } from "./supabase/roopsee";
import { FACE_SHEET } from "./constants";

export function cleanText(value) {
  return value == null ? "" : String(value).replaceAll(" ", " ").trim().replace(/\s+/g, " ");
}

export function normLabel(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normKey(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function firstImage(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = cleanText(item);
      if (/^https?:\/\/\S+/.test(candidate)) return candidate;
    }
    return "";
  }

  const raw = cleanText(value);
  if (!raw) return "";
  let candidate = "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) candidate = cleanText(parsed[0]);
  } catch {
    // The catalog also stores comma- and space-separated URL lists.
  }
  if (!candidate) {
    // Some rows glue multiple URLs together with no delimiter at all, so a
    // greedy \S+ swallows all of them into one broken URL. Stop each match
    // right before the next "http(s)://" starts instead.
    const urls = raw.match(/https?:\/\/(?:(?!https?:\/\/)\S)+/g);
    candidate = urls?.[0]?.replace(/,$/, "") || raw.split(",")[0].trim();
  }
  // Guard against junk like a bare "https://" with no host, which crashes next/image's URL parsing.
  return /^https?:\/\/\S+/.test(candidate) ? candidate : "";
}

function joinList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(", ");
  return cleanText(value);
}

function numberOrNull(value) {
  if (value == null || cleanText(value) === "") return null;
  const number = Number(String(value).replace("%", "").trim());
  return Number.isFinite(number) ? number : null;
}

// Maps the scoring engine's column names (unchanged since the old catalog
// CSV) onto roopsee_products' score columns, so lib/engine.js and
// lib/constants.js need no changes when the data source changes.
const SCORE_FIELD_MAP = {
  "<16": "age_under_16_score",
  "17-25": "age_17_25_score",
  "+>25": "age_above_25_score",
  "Acne": "acne_score",
  "Body Acne": "body_acne_score",
  "Dryness": "dryness_score",
  "Open Pores": "open_pores_score",
  "Uneven Skin Tone": "uneven_skin_tone_score",
  "Dark Spots/Pigmentation": "dark_spots_pigmentation_score",
  "Melasma": "melasma_score",
  "Barrier Repair": "barrier_repair_score",
  "Comedones": "comedones_score",
  "Wrinkles/Fine lines": "wrinkles_fine_lines_score",
  "Redness/Irritation": "redness_irritation_score",
  "Dehydration": "dehydration_score",
  "Dullness": "dullness_score",
  "Tanning": "tanning_score",
  "Oily Score": "oily_score",
  "Oily+Sensitive Score": "oily_sensitive_score",
  "Dry Score": "dry_score",
  "Dry+Sensitive Score": "dry_sensitive_score",
  "Normal Score": "normal_score",
  "Normal+Sensitive Score": "normal_sensitive_score",
  "Combination Score": "combination_score",
  "Combination+Sensitive Score": "combination_sensitive_score",
  "Excessive Dryness score": "excessive_dryness_score",
  "Pregnancy Score": "pregnancy_score",
  "Breastfeeling Score": "breastfeeding_score",
};

const PAGE_SIZE = 1000;

async function fetchAllRows() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await roopseeAdmin
      .from("roopsee_products")
      .select("*")
      .range(from, to);
    if (error) throw new Error(`Failed to load roopsee_products: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function mapRow(row, index) {
  const scores = {};
  for (const [column, field] of Object.entries(SCORE_FIELD_MAP)) {
    const score = numberOrNull(row[field]);
    if (score !== null) scores[column] = score;
  }

  return {
    source_sheet: FACE_SHEET,
    source_row: index + 1,
    product_uid: cleanText(row.product_uid),
    product_name: cleanText(row.product_name),
    brand_name: cleanText(row.brand),
    category: cleanText(row.category_l1),
    product_type: cleanText(row.product_type_l2),
    addresses_skin_concerns: joinList(row.concerns),
    sku_size: cleanText(row.sku),
    mrp: cleanText(row.mrp),
    sp: cleanText(row.selling_price),
    single_hero_ingredient: cleanText(row.single_hero_ingredient),
    secondary_hero_ingredients: joinList(row.secondary_hero_ingredients),
    dos: cleanText(row.dos),
    donts: cleanText(row.donts),
    storage_instructions: cleanText(row.storage_instructions),
    usage_instructions: cleanText(row.usage_instructions),
    when_to_use: cleanText(row.when_to_use),
    ingredient_cautions: cleanText(row.ingredient_caution),
    product_description: cleanText(row.product_description),
    ingredients: cleanText(row.ingredients),
    image: firstImage(row.images),
    database_id: cleanText(row.id),
    scores,
  };
}

let cachedProductsPromise;

export async function loadProducts() {
  if (!cachedProductsPromise) {
    cachedProductsPromise = fetchAllRows()
      .then((rows) => rows
        .filter((row) => cleanText(row.product_uid) && cleanText(row.product_name))
        .map(mapRow))
      .catch((error) => {
        cachedProductsPromise = undefined;
        throw error;
      });
  }
  return cachedProductsPromise;
}

export async function findProduct(productUid) {
  const wantedKey = normKey(decodeURIComponent(productUid || ""));
  const products = await loadProducts();
  return products.find((product) => normKey(product.product_uid) === wantedKey) || null;
}

// Ranks the rest of the catalog against one product: sharing category and
// product_type counts most, brand alone counts least. No shared attribute at
// all means it's not "similar" and gets dropped rather than padding the list.
export async function findSimilarProducts(product, limit = 8) {
  if (!product) return [];

  const products = await loadProducts();
  return products
    .map((candidate) => {
      if (candidate.product_uid === product.product_uid) return null;
      let score = 0;
      if (product.category && candidate.category === product.category) score += 2;
      if (product.product_type && candidate.product_type === product.product_type) score += 2;
      if (product.brand_name && candidate.brand_name === product.brand_name) score += 1;
      return score > 0 ? { candidate, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
