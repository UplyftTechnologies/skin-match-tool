import { supabaseAdmin } from "@/lib/supabase/server";

// Shared by the retailer product detail page and the routine price-compare
// page — the "which listings are the same physical product, sold by a
// different retailer" matching logic, so both surfaces agree on what counts
// as a match instead of drifting apart.

const COMPARISON_FIELDS =
  "id,site,gtin,product_name,variant,mrp,selling_price,discount_pct,in_stock,product_url,image_url,categories,ingredients,description,how_to_use,key_ingredients,product_attributes";

function normalizedProductName(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s*[([]?\s*\d+(?:\.\d+)?\s*(?:ml|millilitres?|l|ltr|litres?|g|gm|grams?|kg)\s*[)\]]?\s*$/i, "")
    .toLowerCase()
    .replace(/\band\b/g, "&")
    .replace(/[^a-z0-9%&]+/g, " ")
    .trim();
}

export function canonicalSize(value) {
  const match = String(value || "")
    .toLowerCase()
    .match(/(\d+(?:\.\d+)?)\s*(ml|millilitres?|l|ltr|litres?|g|gm|grams?|kg)\b/);

  if (!match) return "";
  let amount = Number(match[1]);
  let unit = match[2];

  if (["l", "ltr", "litre", "litres"].includes(unit)) {
    amount *= 1000;
    unit = "ml";
  } else if (unit === "kg") {
    amount *= 1000;
    unit = "g";
  } else if (["millilitre", "millilitres"].includes(unit)) {
    unit = "ml";
  } else if (["gm", "gram", "grams"].includes(unit)) {
    unit = "g";
  }

  return `${amount}${unit}`;
}

function modelCodes(name) {
  const codes = new Set();
  const pattern = /\b([a-z]{1,4})[-\s]?(\d{2,5})\b/gi;
  let match;

  while ((match = pattern.exec(String(name || ""))) !== null) {
    const prefix = match[1].toLowerCase();
    if (!["spf", "pa"].includes(prefix)) {
      codes.add(`${prefix}${match[2]}`);
    }
  }

  return codes;
}

function coreNameTokens(name, brand) {
  const ignored = new Set([
    "&", "a", "all", "and", "for", "in", "of", "skin", "the", "type", "vivo", "with",
    "tested", "test", "dermatologically", "clinically", "new", "original",
  ]);
  const brandTokens = new Set(normalizedProductName(brand).split(/\s+/).filter(Boolean));

  return new Set(
    normalizedProductName(name)
      .split(/\s+/)
      .filter((token) => token && !ignored.has(token) && !brandTokens.has(token)),
  );
}

function nameSimilarity(current, candidate) {
  const currentTokens = coreNameTokens(current.product_name, current.brand);
  const candidateTokens = coreNameTokens(candidate.product_name, current.brand);
  const sharedCount = [...currentTokens]
    .filter((token) => candidateTokens.has(token)).length;
  const smallerSetSize = Math.min(currentTokens.size, candidateTokens.size);
  const combinedSetSize = new Set([...currentTokens, ...candidateTokens]).size;

  return {
    sharedCount,
    coverage: smallerSetSize ? sharedCount / smallerSetSize : 0,
    jaccard: combinedSetSize ? sharedCount / combinedSetSize : 0,
  };
}

function numericSignature(name) {
  return (normalizedProductName(name).match(/\b\d+(?:\.\d+)?/g) || []).join(":");
}

function categoryOverlap(current, candidate) {
  const currentCategories = new Set(
    (current.categories || []).map((category) => category.toLowerCase()),
  );
  return (candidate.categories || [])
    .some((category) => currentCategories.has(category.toLowerCase()));
}

function hasSimilarMrp(current, candidate) {
  const currentMrp = Number(current.mrp);
  const candidateMrp = Number(candidate.mrp);
  if (!Number.isFinite(currentMrp) || !Number.isFinite(candidateMrp)) return false;
  if (currentMrp <= 0 || candidateMrp <= 0) return false;

  return Math.abs(currentMrp - candidateMrp) / Math.max(currentMrp, candidateMrp) <= 0.1;
}

function textTokenSimilarity(left, right) {
  const leftTokens = new Set(
    String(left || "").toLowerCase().match(/[a-z0-9]+/g) || [],
  );
  const rightTokens = new Set(
    String(right || "").toLowerCase().match(/[a-z0-9]+/g) || [],
  );
  if (!leftTokens.size || !rightTokens.size) return 0;

  const sharedCount = [...leftTokens]
    .filter((token) => rightTokens.has(token)).length;
  return sharedCount / new Set([...leftTokens, ...rightTokens]).size;
}

function supportingConfidence(current, candidate) {
  let confidence = 0;
  if (categoryOverlap(current, candidate)) confidence += 0.08;
  if (hasSimilarMrp(current, candidate)) confidence += 0.08;
  if (textTokenSimilarity(current.ingredients, candidate.ingredients) >= 0.5) {
    confidence += 0.09;
  }
  return confidence;
}

function isSameProduct(current, candidate) {
  const currentSize = canonicalSize(current.variant) || canonicalSize(current.product_name);
  const candidateSize = canonicalSize(candidate.variant) || canonicalSize(candidate.product_name);
  if (currentSize !== candidateSize) return false;

  if (normalizedProductName(current.product_name) === normalizedProductName(candidate.product_name)) {
    return true;
  }

  const currentCodes = modelCodes(current.product_name);
  const candidateCodes = modelCodes(candidate.product_name);
  const hasSharedModelCode = [...currentCodes]
    .some((code) => candidateCodes.has(code));
  const hasAnyModelCode = currentCodes.size > 0 || candidateCodes.size > 0;
  const similarity = nameSimilarity(current, candidate);
  const nameConfidence = (similarity.coverage * 0.6) + (similarity.jaccard * 0.4);
  const confidence = nameConfidence + supportingConfidence(current, candidate);

  if (hasAnyModelCode) {
    return hasSharedModelCode
      && similarity.sharedCount >= 3
      && similarity.coverage >= 0.65
      && similarity.jaccard >= 0.45
      && confidence >= 0.72;
  }

  const currentNumbers = numericSignature(current.product_name);
  const candidateNumbers = numericSignature(candidate.product_name);
  if (currentNumbers !== candidateNumbers) return false;

  const strictNameMatch = similarity.sharedCount >= 4
    && similarity.coverage >= 0.8
    && similarity.jaccard >= 0.65;
  const ingredientBackedMatch = textTokenSimilarity(
    current.ingredients,
    candidate.ingredients,
  ) >= 0.75
    && similarity.sharedCount >= 4
    && similarity.coverage >= 0.7
    && similarity.jaccard >= 0.5;
  const metadataBackedMatch = categoryOverlap(current, candidate)
    && hasSimilarMrp(current, candidate)
    && similarity.sharedCount >= 5
    && similarity.coverage >= 0.75
    && similarity.jaccard >= 0.6;

  return strictNameMatch || ingredientBackedMatch || metadataBackedMatch;
}

/**
 * Listings sharing this product's GTIN.
 *
 * A GTIN is the same physical product wherever it is stocked, so this is
 * stronger evidence than any name comparison — and it is the only thing that
 * finds retailers who rename the product wholesale. Nykaa lists barcode
 * 4006000181332 as "NIVEA Luminous Even Glow Brightening Face Serum with
 * Niacinamide, Thiamidol 60X Vitamin C, Aloevera" while Tira calls the same
 * item "Nivea Luminous Even Glow Instant Glow Serum (30 ml)": no name rule
 * will ever pair those, so the card promised "2 retailers" and this panel
 * then found nothing.
 */
async function findByGtin(product) {
  if (!product.gtin) return [];

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select(COMPARISON_FIELDS)
    .eq("gtin", product.gtin)
    .eq("is_active", true)
    .neq("id", product.id)
    .limit(50);

  if (error) {
    console.error("GTIN comparison lookup failed:", error.message);
    return [];
  }
  return data || [];
}

/** Cheapest listing per retailer, cheapest retailer first. */
export function dedupeByRetailer(matches) {
  const bestByRetailer = new Map();

  matches.forEach((item) => {
    const existing = bestByRetailer.get(item.site);
    const itemPrice = Number(item.mrp ?? Number.POSITIVE_INFINITY);
    const existingPrice = Number(existing?.mrp ?? Number.POSITIVE_INFINITY);

    if (!existing || itemPrice < existingPrice) {
      bestByRetailer.set(item.site, item);
    }
  });

  return [...bestByRetailer.values()].sort((left, right) => {
    const leftPrice = Number(left.mrp ?? Number.POSITIVE_INFINITY);
    const rightPrice = Number(right.mrp ?? Number.POSITIVE_INFINITY);
    return leftPrice - rightPrice;
  });
}

export async function findComparableProducts(product) {
  const byGtin = await findByGtin(product);
  if (!product.brand) return dedupeByRetailer([product, ...byGtin]);

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select(COMPARISON_FIELDS)
    .ilike("brand", product.brand)
    .neq("site", product.site)
    .limit(1000);

  if (error) {
    console.error("Failed to find comparable retailer products:", error.message);
    return dedupeByRetailer([product, ...byGtin]);
  }

  const seen = new Set(byGtin.map((row) => row.id));
  const matches = [
    product,
    ...byGtin,
    ...(data || []).filter(
      (candidate) => !seen.has(candidate.id) && isSameProduct(product, candidate),
    ),
  ];
  return dedupeByRetailer(matches);
}
