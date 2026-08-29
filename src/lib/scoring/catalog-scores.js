// Bridges the scored dataset to the live retailer catalogue.
//
// Scoring is profile-dependent, so it cannot be precomputed — but it also does
// not vary within a request, and rank fusion needs the whole set scored before
// any one product's position is known. So a profile's scores are computed once
// and memoised briefly: a listing page paginating through results reuses the
// same pass rather than rescoring 14,119 products per page.
import { SCORED_DATASET, retailerUrlKey } from "./dataset";
import { scoreAll, scoreLabel } from "./engine";
import { RESTRICTED_RULES } from "./ingredient-safety";

const MEMO_TTL_MS = 60 * 1000;
const MEMO_LIMIT = 8;
const memo = new Map();

function profileKey(profile) {
  return JSON.stringify([
    profile.skinType,
    Boolean(profile.sensitive),
    profile.age,
    profile.concern,
    [...(profile.specialConditions || [])].sort(),
  ]);
}

// The dataset holds 14,119 products; the catalogue can only ever show the
// ones it joined to. Scoring the rest was ~15x wasted work on every cold
// pass — the first scoreAll measured 12.6s against 610ms warm, and both
// numbers scale with how many products are scored.
let subsetCache = null;

function datasetSubsetFor(urlKeys) {
  if (subsetCache?.source === urlKeys) return subsetCache.subset;
  const { products } = SCORED_DATASET();
  const subset = products.filter((product) => urlKeys.has(product.urlKey));
  subsetCache = { source: urlKeys, subset };
  return subset;
}

/** Map of dataset urlKey -> score record, for one profile. */
export function scoresByUrlKey(profile, urlKeys) {
  // The key includes the catalogue size so a rebuilt catalogue does not
  // keep serving scores ranked against the previous one.
  const key = `${profileKey(profile)}|${urlKeys ? urlKeys.size : 0}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.builtAt < MEMO_TTL_MS) return hit.map;

  const rows = scoreAll(profile, urlKeys ? datasetSubsetFor(urlKeys) : undefined);
  const map = new Map();
  rows.forEach((row, index) => {
    if (!row.product.urlKey) return;
    map.set(row.product.urlKey, {
      score: row.score,
      label: scoreLabel(row.score),
      evidenceScore: row.evidenceScore,
      confidence: row.product.confidence,
      // Position in the fully ranked list, which is what breaks ties between
      // products displaying the same number.
      rank: index,
      blocked: row.score <= -100,
    });
  });

  memo.set(key, { map, builtAt: Date.now() });
  // Bounded so a burst of distinct profiles cannot grow this without limit.
  if (memo.size > MEMO_LIMIT) {
    const oldest = [...memo.entries()].sort((a, b) => a[1].builtAt - b[1].builtAt)[0];
    memo.delete(oldest[0]);
  }
  return map;
}

// The dataset's own safety columns are the primary model, but they are only as
// careful as the generator that filled them: a "1% Retinol Body Lotion" was
// still returning Good Match to a pregnant profile because its Pregnancy Score
// was never set to -100. The ingredient screen runs on top and can only ever
// take a score away.
function riskyProfile(profile) {
  const conditions = (profile.specialConditions || []).map((c) => String(c).toLowerCase());
  return {
    pregnant: conditions.some((c) => c.includes("pregnan")),
    breastfeeding: conditions.some((c) => c.includes("breastfeed")),
    teen: profile.age === "Teen",
  };
}

function overriddenByIngredients(product, risk) {
  if (!risk.pregnant && !risk.breastfeeding && !risk.teen) return null;
  for (const id of product.restricted || []) {
    const rule = RESTRICTED_RULES.find((item) => item.id === id);
    if (rule && rule.blocks.some((flag) => risk[flag])) return rule;
  }
  return null;
}

/** Attaches a score to each catalogue card that has one. */
export function attachScores(products, profile, scope) {
  if (!profile) return products.map((product) => ({ ...product, scoring: null }));
  // `scope` is the set the ranks are computed against — the whole filtered
  // result set, not just the page being annotated. Deriving it from
  // `products` would rescore on every page and rank 20 products against
  // each other instead of against the full list.
  const urlKeys = new Set(
    (scope || products).map((product) => retailerUrlKey(product.product_url)).filter(Boolean),
  );
  const scores = scoresByUrlKey(profile, urlKeys);
  const risk = riskyProfile(profile);

  return products.map((product) => {
    const scoring = scores.get(retailerUrlKey(product.product_url)) || null;
    const override = overriddenByIngredients(product, risk);
    if (!override) return { ...product, scoring };

    return {
      ...product,
      scoring: {
        ...(scoring || { evidenceScore: null, confidence: null, rank: Number.MAX_SAFE_INTEGER }),
        score: -100,
        label: "Not suggested",
        blocked: true,
        blockedBy: override.label,
        blockReason: override.reason,
      },
    };
  });
}

export function scoringCoverage() {
  return SCORED_DATASET().byUrlKey.size;
}
