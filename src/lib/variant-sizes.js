// Size variants of one product, for the product detail page.
//
// Two sources, because neither alone is enough:
//
//   parent_product_id — the retailer's own id for a product line, with one row
//     per size beneath it. Populated for amazon, nykaa, tira and broadway (0%
//     on purplle and kindlife). Authoritative when present, but applied
//     inconsistently: Tira groups the Caudalie Instant Foaming Cleanser's 50ml
//     and 150ml under parent 7533896, yet files the same range's Moisturizing
//     Toning Lotion 200ml under 7533984 and its 100ml under 7533998.
//
//   the name with its size removed — two listings from one brand differing
//     only by a quantity are the same product in different sizes, which is
//     exactly what this page needs to offer.
//
// The raw groups are not presentable as they stand: they carry placeholder
// variants ("1 size", "2 sizes"), repeat a size, and include multipacks, which
// are a different purchase rather than a different size.
import { isMultipack, normalize, sizes } from "@/lib/retailer-match";

/** Identifies a product line independently of the size it is sold in. */
export function variantBaseKey(row) {
  const name = normalize(row?.product_name)
    // "(200ml)", "200 ml", "6.7 fl oz", "pack of 2", "- 50g". The trailing
    // word boundary matters: without it the "g" alternative also fires inside
    // "50 gold", quietly merging unrelated products into one size family.
    .replace(/\b\d+(?:\.\d+)?\s*(?:fl\s*oz|ml|gms|gm|kg|oz|pcs|pc|count|l|g)\b/g, " ")
    .replace(/\bpack\s+of\s+\d+\b/g, " ")
    // Retailers name the small size "Mini" instead of stating it.
    .replace(/\bmini\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) return "";
  return `${normalize(row?.brand)}|${name}`;
}

function priceOf(row) {
  const value = Number(row.mrp);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The size this listing is for, normalised to ml or g.
 *
 * The `variant` column states it most reliably; the name is the fallback,
 * since Tira writes "(200ml)" into the title while Nykaa often leaves variant
 * as the useless "1 size". Two different quantities in one string is a kit or
 * a bundle, not a size, so those are rejected rather than guessed at.
 */
export function listingSize(row) {
  const fromVariant = sizes(row?.variant);
  if (fromVariant.length === 1) return fromVariant[0];
  const fromName = sizes(row?.product_name);
  if (fromName.length === 1) return fromName[0];
  return null;
}

/** Sorts 50ml before 200ml. */
function sizeOrder(label) {
  const amount = Number(String(label).replace(/[^\d.]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

/** True when `candidate` is the same product line as `current`. */
export function isSizeSibling(current, candidate) {
  if (!current || !candidate) return false;
  if (String(candidate.id) === String(current.id)) return false;
  // Prices and availability are per retailer, so a size option has to be
  // buyable from the retailer whose page the shopper is on.
  if (candidate.site !== current.site) return false;

  if (current.parent_product_id && candidate.parent_product_id === current.parent_product_id) {
    return true;
  }
  const key = variantBaseKey(current);
  return Boolean(key) && variantBaseKey(candidate) === key;
}

/**
 * Builds the size options for a product detail page.
 *
 * Returns [] when there is nothing to choose between — a selector showing a
 * single option is just noise.
 */
export function buildSizeOptions(current, siblings) {
  const bySize = new Map();

  for (const row of [current, ...siblings].filter(Boolean)) {
    // A 2-pack is a different purchase at a different price. It is not the
    // "150ml" option, and offering it as one misprices the choice.
    if (isMultipack(row)) continue;

    const size = listingSize(row);
    if (!size) continue;

    // One size can appear twice under a parent — a relisting, or two sellers.
    // Keep the cheapest, which is what the page should link to.
    const existing = bySize.get(size);
    if (!existing || (priceOf(row) ?? Infinity) < (priceOf(existing) ?? Infinity)) {
      bySize.set(size, row);
    }
  }

  // A product whose own size cannot be read cannot be marked as the selected
  // option, and an unmarked selector is worse than none.
  if (!listingSize(current) || bySize.size < 2) return [];

  return [...bySize.entries()]
    .map(([size, row]) => ({
      size,
      id: String(row.id),
      price: priceOf(row),
      inStock: row.in_stock !== false,
      current: String(row.id) === String(current.id),
    }))
    .sort((left, right) => sizeOrder(left.size) - sizeOrder(right.size));
}
