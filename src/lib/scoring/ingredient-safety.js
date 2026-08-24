// Ingredient-text safety screening for products that carry no doctor-assigned
// safety columns.
//
// The scoring engine's real safety model reads per-product Pregnancy /
// Breastfeeling / <16 columns, where -100 is a hard block. Retailer rows have
// none of those, so for anything without a doctor anchor this is the only
// safety signal available — a keyword pass over the ingredient list, modelled
// on the retinoid detection in the Python engine (retinol / retinal /
// retinoid / retinyl / tretinoin / adapalene).
//
// Two things this module refuses to do:
//   1. Call a product safe. It reports BLOCKED or UNKNOWN, never "fine".
//   2. Assess a product with no ingredient list. ~47% of retailer rows have no
//      ingredients at all, and silence there is absence of evidence, not
//      evidence of absence — `assessable` is false and the caller must not
//      show a score to an at-risk profile.
import { normLabel } from "@/lib/data";

// Ingredient text arrives with soft hyphens and zero-width characters mixed
// into words — a real list here read "Hydroxyp­Inacolone Retinoate", which no
// plain word match can see. Strip them before testing anything.
function normalizeText(value) {
  return String(value || "")
    // Explicit escapes: soft hyphen and the zero-width family are invisible
    // in source, so writing them literally makes this line unmaintainable.
    .replace(/[­​‌‍﻿]/g, "")
    .replace(/\s+/g, " ");
}

// Screened against the ingredient list AND the product name.
//
// Name matching was left out at first, on the grounds that "retinol
// alternative" marketing would cause false blocks. Measured against the live
// catalogue that was the wrong trade: 16 products named as retinoids passed the
// ingredient screen, because "Olay Retinol 24" lists its active only as
// "Vitamin A" and Elizabeth Arden's list is truncated before the actives. For a
// pregnancy contraindication a false block costs a hidden score; a false pass
// costs the thing the screen exists to prevent.
export const RESTRICTED_RULES = [
  {
    id: "retinoid",
    label: "Retinoid",
    // The Python engine's list, plus prescription forms, plus two additions
    // the live catalogue forced: "vitamin a" is the retail name for retinol and
    // is the ONLY active "Olay Retinol 24" lists, and bare "retinoate" catches
    // hydroxypinacolone retinoate however the list spells it.
    // No leading \b: brands compound the word into one token — "BioRetinol",
    // "PhytoRetinol", "ProRetinol" — and a leading boundary misses all of them.
    // Some of those are bakuchiol rather than a true retinoid, so this will
    // over-block; that is the intended direction of error here, but it is worth
    // a dermatologist's review before the list is treated as settled.
    pattern:
      /(retinol|retinal|retinaldehyde|retinoid|retinoate|retinyl\s+\w+|tretinoin|adapalene|tazarotene|isotretinoin|hydroxypinacolone|granactive|\bvitamin\s+a)\b/i,
    blocks: ["pregnant", "breastfeeding", "teen"],
    reason: "Contains a retinoid, which is not advised during pregnancy or breastfeeding.",
  },
  {
    id: "hydroquinone",
    label: "Hydroquinone",
    pattern: /\bhydroquinone\b/i,
    blocks: ["pregnant", "breastfeeding", "teen"],
    reason: "Contains hydroquinone, which is not advised during pregnancy or breastfeeding.",
  },
  {
    id: "salicylic-high",
    label: "High-strength salicylic acid",
    // Only flagged above 2%: the low concentrations in everyday cleansers are
    // not what the caution is about, so matching bare "salicylic acid" would
    // block most of the acne category for no reason.
    pattern: /\b([3-9](?:\.\d+)?|[1-9]\d+(?:\.\d+)?)\s*%\s*(?:\w+\s+){0,2}salicylic\s+acid\b/i,
    blocks: ["pregnant", "breastfeeding"],
    reason: "Contains salicylic acid above the concentration usually advised in pregnancy.",
  },
  {
    id: "oral-strength-acids",
    pattern: /\b(tazarotene|isotretinoin|accutane)\b/i,
    label: "Prescription retinoid",
    blocks: ["pregnant", "breastfeeding", "teen"],
    reason: "Contains a prescription-strength retinoid.",
  },
];

// Which profile facts turn a rule into a block.
function riskFlags(profile) {
  const conditions = (profile?.selectedSpecialConditions || []).map(normLabel);
  const age = normLabel(profile?.age);
  return {
    pregnant: conditions.some((item) => item.includes("pregnan")),
    breastfeeding: conditions.some((item) => item.includes("breastfeed")),
    teen: ["teen", "under 16", "below 16", "<16", "16"].includes(age),
  };
}

export function hasAssessableIngredients(product) {
  const text = normalizeText(product?.ingredients).trim();
  // A handful of characters is a placeholder, not an ingredient list.
  return text.length >= 20;
}

/**
 * Every rule matching this product, from either its ingredient list or its
 * name. `source` records which, so a block is auditable — a name-only hit is
 * a weaker signal that still blocks, and is worth reviewing.
 */
export function detectRestrictedActives(product) {
  const ingredients = normalizeText(product?.ingredients);
  const name = normalizeText(product?.product_name);

  return RESTRICTED_RULES.map((rule) => {
    const inIngredients = ingredients.length >= 20 && rule.pattern.test(ingredients);
    // A concentration rule is meaningless against a name, so only the actives
    // rules are allowed to fire on the name alone.
    const inName = rule.id !== "salicylic-high" && rule.pattern.test(name);
    if (!inIngredients && !inName) return null;
    return { ...rule, source: inIngredients ? "ingredients" : "name" };
  }).filter(Boolean);
}

/**
 * Screens one product against one profile.
 *
 * Returns `assessable: false` when there is no ingredient list to read. That
 * is NOT a pass — it means this product cannot be shown with a score to a
 * pregnant, breastfeeding or under-16 profile, because nothing here can rule
 * out a contraindicated active.
 */
export function screenProduct(product, profile) {
  const risk = riskFlags(profile);
  const atRisk = risk.pregnant || risk.breastfeeding || risk.teen;

  if (!atRisk) {
    return { atRisk: false, assessable: true, blocked: false, matches: [] };
  }

  const matches = detectRestrictedActives(product).filter((rule) =>
    rule.blocks.some((flag) => risk[flag]),
  );

  // A name hit is decisive even with no ingredient list — that is the whole
  // point of reading the name, since 192 retinoid-named rows publish no
  // ingredients at all.
  if (!matches.length && !hasAssessableIngredients(product)) {
    return {
      atRisk: true,
      assessable: false,
      blocked: false,
      matches: [],
      reason: "No ingredient list is published for this product, so it cannot be checked.",
    };
  }

  return {
    atRisk: true,
    assessable: true,
    blocked: matches.length > 0,
    matches: matches.map(({ id, label, reason, source }) => ({ id, label, reason, source })),
    reason: matches[0]?.reason,
  };
}

/**
 * The rule a caller should apply before rendering a score.
 *
 * Screening can only ever justify hiding a score, never raising confidence in
 * one — so this returns a boolean about display, not about safety.
 */
export function canShowScore(product, profile) {
  const screening = screenProduct(product, profile);
  if (!screening.atRisk) return true;
  return screening.assessable && !screening.blocked;
}
