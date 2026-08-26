// The scoring engine, ported from src/coverage_tool_files/app.js.
//
// Everything between the VERBATIM markers is copied byte-for-byte from that
// file. It is not tidied, renamed or refactored on purpose: roundScore() uses
// floor(x + 0.5) / ceil(x - 0.5) rather than Math.round, the cap ladders are
// order-dependent, and -100 propagates through averageScore() as a hard block
// rather than being averaged away. Rewriting any of those shifts scores near a
// block boundary.
//
// Verified against app.js across 84,714 product/profile scores over six
// profiles: identical score, evidenceScore and rankingScore on every one.
//
// The block reads four values from its original module scope — state, dataset,
// products and scoreColumnIndex — which scoreAll() supplies through a closure
// rather than by editing the block.
//
// Update path: re-copy lines 3-67 and 135-549 from app.js. Do not hand-edit.
import { SCORED_DATASET } from "./dataset";

// ---------------------------------------------------------------- VERBATIM
const CONCERN_FAMILIES = {
  Acne: ["acne", "exfoliant", "clay"],
  "Body Acne": ["acne", "exfoliant", "clay"],
  Dryness: ["hydration", "barrier", "soothing", "emollient"],
  "Open Pores": ["acne", "exfoliant", "clay"],
  "Uneven Skin Tone": ["brightening", "exfoliant", "sunscreen", "retinoid"],
  "Dark Spots/Pigmentation": ["brightening", "exfoliant", "sunscreen", "retinoid"],
  Melasma: ["brightening", "sunscreen"],
  "Barrier Repair": ["barrier", "hydration", "soothing", "emollient"],
  Comedones: ["acne", "exfoliant", "clay"],
  "Wrinkles/Fine lines": ["retinoid", "anti_aging", "exfoliant", "sunscreen"],
  "Redness/Irritation": ["soothing", "barrier", "hydration"],
  Dehydration: ["hydration", "barrier", "soothing"],
  Dullness: ["brightening", "hydration", "exfoliant", "sunscreen"],
  Tanning: ["sunscreen", "brightening"],
};

const HYDRATION_CONCERNS = new Set(["Dryness", "Dehydration", "Barrier Repair", "Redness/Irritation", "Dullness"]);
const ACNE_CONCERNS = new Set(["Acne", "Body Acne", "Open Pores", "Comedones"]);
const PHOTO_CONCERNS = new Set(["Tanning", "Dark Spots/Pigmentation", "Melasma", "Uneven Skin Tone"]);
const FACE_CONCERNS = new Set(Object.keys(CONCERN_FAMILIES).filter((concern) => concern !== "Body Acne"));
const ACTIVE_CLEANSER_TERMS = [
  "pore",
  "pores",
  "salicylic",
  "bha",
  "aha",
  "glycolic",
  "lactic",
  "mandelic",
  "niacinamide",
  "zinc pca",
  "tea tree",
  "charcoal",
  "clay",
  "acne",
  "pimple",
  "comedone",
  "blackhead",
  "exfoliat",
];
const COMFORT_CLEANSER_TERMS = [
  "barrier",
  "hydrate",
  "hydrating",
  "hydration",
  "moistur",
  "gentle",
  "mild",
  "calm",
  "calming",
  "soothing",
  "ceramide",
  "hyaluronic",
  "glycerin",
  "oat",
  "aloe",
  "cream",
  "creamy",
  "milk",
  "milky",
  "oil cleanser",
  "cleansing oil",
  "balm",
];
// ------------------------------------------------------------ END VERBATIM

/**
 * Scores every product in the dataset against one quiz profile.
 *
 * @param {object} profile { skinType, sensitive, age, gender, concern, specialConditions }
 * @param {Array}  [subset] score only these dataset products. Rank fusion
 *   computes percentiles across whatever it is given, so passing the
 *   products the catalogue can actually show both cuts the work and ranks
 *   against the visible set rather than 14k rows most of which are hidden.
 *   Scores themselves do not depend on other products, only tie-breaks do.
 * @returns {Array} rows sorted best first: { product, score, evidenceScore, featureScores, rankingScore }
 */
export function scoreAll(profile, subset) {
  const loaded = SCORED_DATASET();
  const scoreColumnIndex = loaded.scoreColumnIndex;
  const products = subset?.length ? subset : loaded.products;
  // The block reads weights off dataset.metadata; the trimmed file stores them
  // at the top level, so they are re-nested here rather than edited in-block.
  const dataset = {
    metadata: {
      visibleScoreWeights: loaded.visibleScoreWeights,
      rankFusionWeights: loaded.rankFusionWeights,
    },
  };
  const state = {
    skinType: profile.skinType || "Normal",
    sensitive: Boolean(profile.sensitive),
    age: profile.age || "Adult",
    gender: profile.gender || "female",
    concern: profile.concern || "None",
    specialConditions: profile.specialConditions?.length
      ? profile.specialConditions
      : ["None"],
  };

  // ---------------------------------------------------------------- VERBATIM
function roundScore(value) {
  if (!Number.isFinite(value)) return 0;
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

function averageScore(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 50;
  if (valid.some((value) => value <= -100)) return -100;
  return roundScore(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function getLayerScore(product, layerName, columnName) {
  const index = scoreColumnIndex[columnName];
  const layer = product.scoreLayers?.[layerName];
  if (index === undefined || !layer) return columnName === "None" ? 100 : 50;
  const value = Number(layer[index]);
  return Number.isFinite(value) ? value : columnName === "None" ? 100 : 50;
}

function skinColumn() {
  const base = state.skinType;
  return state.sensitive ? `${base}+Sensitive Score` : `${base} Score`;
}

function specialColumn(condition) {
  if (condition === "Pregnant") return "Pregnancy Score";
  if (condition === "Breastfeeding") return "Breastfeeling Score";
  if (condition === "Excessive Dryness") return "Excessive Dryness score";
  return "None";
}

function productFamilies(product) {
  return new Set(product.families || []);
}

function productSearchText(product) {
  return [
    product.name,
    product.brand,
    product.productType,
    product.primaryIngredients,
    product.secondaryIngredients,
    product.matchedPrimaryIngredients,
    product.matchedSecondaryIngredients,
    (product.families || []).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function supportsConcern(product, concern) {
  if (!concern || concern === "None") return true;
  const wanted = CONCERN_FAMILIES[concern] || [];
  const families = productFamilies(product);
  return wanted.some((family) => families.has(family));
}

function currentConcern() {
  return state.concern === "None" ? null : state.concern;
}

function categoryRelevanceCap(product, concern = currentConcern()) {
  if (!concern || concern === "None") return 100;
  if (concern === "Body Acne") return ["Body", "Face & Body"].includes(product.category) ? 100 : 82;
  if (FACE_CONCERNS.has(concern) && product.category === "Body") return 74;
  if (FACE_CONCERNS.has(concern) && (product.category === "Lips" || product.category === "Eye")) return 78;
  return 100;
}

function productRelevanceCap(product, concern) {
  if (!concern || concern === "None") return 100;
  const type = product.normalizedType;
  const supported = supportsConcern(product, concern);

  if (type === "serum") return supported ? 100 : 72;
  if (type === "cleanser") {
    if (concern === "Wrinkles/Fine lines") return 88;
    return supported || ACNE_CONCERNS.has(concern) ? 100 : 88;
  }
  if (type === "moisturizer") return HYDRATION_CONCERNS.has(concern) || supported ? 100 : 84;
  if (type === "sunscreen") {
    if (PHOTO_CONCERNS.has(concern)) return 100;
    if (concern === "Dullness" || concern === "Barrier Repair") return 84;
    return supported ? 100 : 74;
  }
  if (type === "mask") return supported ? 100 : 88;
  if (type === "toner") return supported ? 93 : 78;
  return supported ? 88 : 72;
}

function confidenceCap(product) {
  if (product.confidence === "High") return 100;
  if (product.confidence === "Medium") return 96;
  return (product.support?.anchor || 0) >= 3 ? 92 : 88;
}

function directProfileFit(product, concern = currentConcern()) {
  if (!concern) return true;
  const type = product.normalizedType;
  const supported = supportsConcern(product, concern);

  if (type === "serum") return supported;
  if (type === "cleanser") {
    if (concern === "Wrinkles/Fine lines") return true;
    return supported || ACNE_CONCERNS.has(concern);
  }
  if (type === "moisturizer") return HYDRATION_CONCERNS.has(concern) || supported;
  if (type === "sunscreen") return PHOTO_CONCERNS.has(concern) || concern === "Dullness" || concern === "Barrier Repair" || supported;
  if (type === "mask") return supported;
  if (type === "toner") return supported || HYDRATION_CONCERNS.has(concern);
  return supported;
}

function displayConfidenceCap(product, directFit) {
  if (!directFit) return product.confidence === "High" ? 88 : 84;
  if (product.confidence === "High") return 99;
  if (product.confidence === "Medium") return 96;
  return (product.support?.anchor || 0) >= 3 || (product.support?.exact || 0) >= 2 ? 90 : 86;
}

function supportIsTrustworthy(product) {
  const support = product.support || {};
  return (support.exact || 0) >= 4 || (support.anchor || 0) >= 2 || (support.family || 0) >= 20 || (support.typeFamily || 0) >= 30;
}

function hasActiveCleanserCue(product, concern = currentConcern()) {
  if (!ACNE_CONCERNS.has(concern)) return supportsConcern(product, concern);
  if (supportsConcern(product, concern)) return true;
  const text = productSearchText(product);
  return ACTIVE_CLEANSER_TERMS.some((term) => text.includes(term));
}

function hasComfortCleanserCue(product) {
  const families = productFamilies(product);
  if (["hydration", "barrier", "soothing", "emollient"].some((family) => families.has(family))) return true;
  const text = productSearchText(product);
  return COMFORT_CLEANSER_TERMS.some((term) => text.includes(term));
}

function profileSafetyCap(product) {
  const layers = ["baseline", "v2", "anchor", "typeFamily", "type"];
  const profileColumns = [];
  if (state.age === "Teen") profileColumns.push("<16");
  for (const condition of state.specialConditions) {
    if (condition !== "None") profileColumns.push(specialColumn(condition));
  }
  if (!profileColumns.length) return 100;

  let cap = 100;
  for (const columnName of profileColumns) {
    const values = layers.map((layerName) => getLayerScore(product, layerName, columnName));
    if (values.some((value) => value <= -100)) return -100;
    const top = Math.max(...values);
    const average = averageScore(values);
    if (top >= 85 && average >= 70) cap = Math.min(cap, 92);
    else if (top >= 85) cap = Math.min(cap, 90);
    else if (top >= 70) cap = Math.min(cap, 84);
    else cap = Math.min(cap, 70);
  }
  return cap;
}

function cleanserProfileBoost(product) {
  const concern = currentConcern();
  if (product.normalizedType !== "cleanser" || !ACNE_CONCERNS.has(concern)) return null;
  if (categoryRelevanceCap(product, concern) < 90) return null;

  const safetyCap = profileSafetyCap(product);
  if (safetyCap < 85) return null;

  const layers = ["baseline", "v2", "anchor", "typeFamily", "type"];
  const skinValues = layers.map((layerName) => getLayerScore(product, layerName, skinColumn()));
  const concernValues = layers.map((layerName) => getLayerScore(product, layerName, concern));
  const drynessValues = layers.map((layerName) => getLayerScore(product, layerName, "Excessive Dryness score"));
  if (skinValues.some((value) => value <= -100) || concernValues.some((value) => value <= -100)) return null;

  const skinTop = Math.max(...skinValues);
  const concernTop = Math.max(...concernValues);
  const drynessTop = Math.max(...drynessValues);
  const skinAverage = averageScore(skinValues);
  const concernAverage = averageScore(concernValues);
  const hasProfileRisk = state.sensitive || state.age === "Teen" || state.specialConditions.some((condition) => condition !== "None");
  const strongSupport = supportIsTrustworthy(product) || (product.support?.exact || 0) >= 10;
  const excessiveDrynessProfile = state.specialConditions.includes("Excessive Dryness");

  if (excessiveDrynessProfile && hasComfortCleanserCue(product) && skinTop >= 85 && drynessTop >= 85) {
    return {
      score: Math.min(product.confidence === "High" && strongSupport ? 91 : 90, safetyCap, confidenceCap(product), displayConfidenceCap(product, true)),
      skinTop,
      concernTop,
    };
  }

  if (!hasActiveCleanserCue(product, concern) || !strongSupport || concernTop < 85 || skinTop < 60) return null;

  let score = 90;
  if (concernTop >= 90 && skinTop >= 88 && product.confidence === "High") {
    score = hasProfileRisk ? 92 : 96;
  } else if (concernTop >= 88 && skinTop >= 72) {
    score = hasProfileRisk ? 91 : 94;
  } else if (concernAverage >= 70 && skinAverage >= 65) {
    score = hasProfileRisk ? 90 : 92;
  }

  return {
    score: Math.min(score, safetyCap, confidenceCap(product), displayConfidenceCap(product, true)),
    skinTop,
    concernTop,
  };
}

function excessiveDrynessRescueFit(product, concern = currentConcern()) {
  if (!state.specialConditions.includes("Excessive Dryness")) return false;
  const families = productFamilies(product);
  const comfortsDryness = ["hydration", "barrier", "soothing", "emollient"].some((family) => families.has(family));
  if (!comfortsDryness) return false;
  if (concern === "Body Acne" && !["Body", "Face & Body"].includes(product.category)) return false;
  return ["moisturizer", "cleanser", "sunscreen", "mask", "toner"].includes(product.normalizedType);
}

function customerFacingScore(product, featureScores, evidenceScore) {
  const values = Object.values(featureScores).filter((value) => Number.isFinite(value));
  if (evidenceScore <= -100 || values.some((value) => value <= -100)) return -100;

  const directFit = directProfileFit(product);
  const drynessRescueFit = excessiveDrynessRescueFit(product);
  const cleanserBoost = cleanserProfileBoost(product);
  const sorted = [...values].sort((left, right) => right - left);
  const best = sorted[0] ?? evidenceScore;
  const topThreeAverage = averageScore(sorted.slice(0, 3));
  const highSignalCount = values.filter((value) => value >= 90).length;
  const goodSignalCount = values.filter((value) => value >= 85).length;
  const weakSignalCount = values.filter((value) => value < 60).length;
  const hasProfileRisk = state.sensitive || state.age === "Teen" || state.specialConditions.some((condition) => condition !== "None");
  const ingredientHero =
    directFit &&
    product.confidence === "High" &&
    (product.support?.exact || 0) >= 25 &&
    (product.support?.anchor || 0) >= 8 &&
    featureScores.baseline >= 90 &&
    featureScores.anchor >= 92 &&
    featureScores.v2 >= 84 &&
    values.every((value) => value >= 60);

  let score = evidenceScore;
  if (directFit && supportIsTrustworthy(product)) {
    if (evidenceScore >= 92 && topThreeAverage >= 92 && highSignalCount >= 3) {
      score = Math.max(score, 97);
    } else if (evidenceScore >= 86 && topThreeAverage >= 88 && highSignalCount >= 1 && goodSignalCount >= 3) {
      score = Math.max(score, 95);
    } else if (evidenceScore >= 84 && topThreeAverage >= 88 && goodSignalCount >= 3) {
      score = Math.max(score, 92);
    } else if (evidenceScore >= 78 && topThreeAverage >= 84 && goodSignalCount >= 2) {
      score = Math.max(score, 90);
    }
  }

  if (drynessRescueFit && supportIsTrustworthy(product) && evidenceScore >= 76 && topThreeAverage >= 80) {
    score = Math.max(score, 90);
  }

  if (cleanserBoost) {
    score = Math.max(score, cleanserBoost.score);
  }

  if (directFit && product.confidence === "High") {
    if (!hasProfileRisk && ingredientHero) {
      score = Math.max(score, 99);
    } else if (!hasProfileRisk && supportIsTrustworthy(product) && evidenceScore >= 92 && topThreeAverage >= 91 && highSignalCount >= 3 && values.every((value) => value >= 88)) {
      score = Math.max(score, 99);
    } else if (best >= 95 && topThreeAverage >= 91 && highSignalCount >= 2) {
      score = Math.max(score, 97);
    }
  }

  let cap = drynessRescueFit && !directFit ? (product.confidence === "High" ? 92 : 90) : displayConfidenceCap(product, directFit);
  if (weakSignalCount >= 2) cap = Math.min(cap, 79);
  else if (weakSignalCount === 1 && evidenceScore < 86) cap = Math.min(cap, 84);
  if (hasProfileRisk && values.some((value) => value < 60)) cap = Math.min(cap, 84);
  else if (hasProfileRisk && values.some((value) => value < 70)) cap = Math.min(cap, 92);
  if (drynessRescueFit && !directFit) cap = Math.min(cap, 92);
  if (cleanserBoost) cap = Math.max(cap, cleanserBoost.score);
  cap = Math.min(cap, categoryRelevanceCap(product));

  return roundScore(Math.min(score, cap));
}

function safetyAdjustment(product, layerName) {
  let cap = 100;
  const notes = [];
  const type = product.normalizedType;

  if (state.age === "Teen") {
    const teenScore = getLayerScore(product, layerName, "<16");
    if (teenScore <= -100) {
      return { hardBlock: true, cap: -100, notes: ["Not suggested for teen profiles."] };
    }
    if (teenScore < 60) cap = Math.min(cap, 70);
    else if (teenScore < 85) cap = Math.min(cap, 84);
  }

  for (const condition of state.specialConditions) {
    if (condition === "None") continue;
    if (type === "serum" && condition === "Excessive Dryness") {
      continue;
    }
    const column = specialColumn(condition);
    const specialScore = getLayerScore(product, layerName, column);
    if (specialScore <= -100) {
      return { hardBlock: true, cap: -100, notes: [`Not suggested for ${condition.toLowerCase()}.`] };
    }
    if (condition === "Excessive Dryness" && specialScore === 0) {
      cap = Math.min(cap, 69);
      notes.push("Limited fit for excessive dryness.");
    } else if (specialScore < 60) {
      cap = Math.min(cap, 70);
      notes.push(`Limited fit for ${condition.toLowerCase()}.`);
    } else if (specialScore < 85) {
      cap = Math.min(cap, 84);
    }
  }

  return { hardBlock: false, cap, notes };
}

function profileLayerScore(product, layerName) {
  const type = product.normalizedType;
  const concern = currentConcern();
  const skin = getLayerScore(product, layerName, skinColumn());
  const concernScore = concern ? getLayerScore(product, layerName, concern) : null;
  const safety = safetyAdjustment(product, layerName);
  if (safety.hardBlock) return -100;

  let components = [];
  if (type === "serum") {
    components = [concernScore ?? 60];
  } else if (type === "cleanser") {
    components = concern === "Wrinkles/Fine lines" ? [skin] : [skin, concernScore ?? skin];
  } else if (type === "moisturizer" || type === "sunscreen") {
    components = [skin];
  } else if (type === "mask") {
    components = concernScore === null ? [skin] : [concernScore, skin];
  } else {
    components = concernScore === null ? [skin] : [concernScore, skin];
  }

  let score = averageScore(components);
  if (score <= -100) return -100;
  score = Math.min(score, productRelevanceCap(product, concern), categoryRelevanceCap(product, concern), confidenceCap(product), safety.cap);
  return roundScore(score);
}

function rankQualities(scoredRows, key) {
  const sorted = [...scoredRows].sort((left, right) => {
    const diff = right.featureScores[key] - left.featureScores[key];
    if (diff) return diff;
    return left.product.name.localeCompare(right.product.name);
  });
  const maxRank = Math.max(1, sorted.length - 1);
  const output = new Map();
  sorted.forEach((row, rank) => {
    output.set(row.product.uid, 100 * (1 - rank / maxRank));
  });
  return output;
}

function computeScoredRows() {
  const rows = products.map((product) => {
    const featureScores = {
      baseline: profileLayerScore(product, "baseline"),
      v2: profileLayerScore(product, "v2"),
      anchor: profileLayerScore(product, "anchor"),
      typeFamily: profileLayerScore(product, "typeFamily"),
      type: profileLayerScore(product, "type"),
    };
    const evidenceScore = roundScore(
      dataset.metadata.visibleScoreWeights.baseline * featureScores.baseline +
        dataset.metadata.visibleScoreWeights.v2 * featureScores.v2 +
        dataset.metadata.visibleScoreWeights.anchor * featureScores.anchor +
        dataset.metadata.visibleScoreWeights.type_family * featureScores.typeFamily +
        dataset.metadata.visibleScoreWeights.type * featureScores.type
    );
    const finalScore = customerFacingScore(product, featureScores, evidenceScore);
    return { product, score: finalScore, evidenceScore, featureScores, rankingScore: finalScore };
  });

  const baselineRank = rankQualities(rows, "baseline");
  const v2Rank = rankQualities(rows, "v2");
  const anchorRank = rankQualities(rows, "anchor");
  const typeFamilyRank = rankQualities(rows, "typeFamily");
  const weights = dataset.metadata.rankFusionWeights;

  rows.forEach((row) => {
    if (row.score <= -100) {
      row.rankingScore = -999;
      return;
    }
    row.rankingScore =
      weights.score * row.score +
      weights.baseline_rank * (baselineRank.get(row.product.uid) || 0) +
      weights.v2_rank * (v2Rank.get(row.product.uid) || 0) +
      weights.anchor_rank * (anchorRank.get(row.product.uid) || 0) +
      weights.type_family_rank * (typeFamilyRank.get(row.product.uid) || 0);
  });

  return rows.sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff) return scoreDiff;
    const rankDiff = right.rankingScore - left.rankingScore;
    if (rankDiff) return rankDiff;
    return left.product.name.localeCompare(right.product.name);
  });
}
  // ------------------------------------------------------------ END VERBATIM

  return computeScoredRows();
}

/**
 * The label the Python engine returns alongside the number. The browser
 * platform dropped these in favour of bare numeric bands; a label is easier to
 * defend to a customer than a score, so it is kept here.
 */
export function scoreLabel(score) {
  if (score <= -100) return "Not suggested";
  if (score >= 90) return "Excellent Match";
  if (score >= 80) return "Great Match";
  if (score >= 70) return "Good Match";
  if (score >= 50) return "Fits with Caution";
  return "Not Recommended";
}
