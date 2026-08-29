import { AGE_COLUMNS, CONCERN_COLUMNS, QUIZ_OPTIONS, THRESHOLDS } from "./constants";
import { cleanText, loadProducts, normKey, normLabel } from "./data";
import { sanitizeProfile } from "./profiles";

function ageColumns(age) {
  return AGE_COLUMNS[normLabel(age)] || [];
}

function isSensitive(profile) {
  if (typeof profile.selectedSensitive === "boolean") return profile.selectedSensitive;
  const label = normLabel(profile.selectedSensitive);
  if (["yes", "true", "1", "y", "sensitive"].includes(label)) return true;
  if (["no", "false", "0", "n", "not sensitive", "none"].includes(label)) return false;
  return normLabel(profile.selectedSkinType).includes("sensitive");
}

function isUnder16(profile) {
  return JSON.stringify(ageColumns(profile.age)) === JSON.stringify(["<16"]);
}

function hasSpecialCondition(profile) {
  const conditions = (profile.selectedSpecialConditions || []).map(normLabel).filter(Boolean);
  return conditions.length > 0 && !(conditions.length === 1 && conditions[0] === "none");
}

function isDryOrSensitive(profile) {
  return normLabel(profile.selectedSkinType) === "dry" || isSensitive(profile);
}

function hasAntiAgingConcern(profile) {
  return [...(profile.selectedFaceBodyConcerns || []), ...(profile.selectedLipsEyesConcerns || [])]
    .some((concern) => {
      const label = normLabel(concern);
      return ["aging", "anti aging", "anti ageing", "wrinkles fine lines"].includes(label)
        || label.includes("wrinkle")
        || label.includes("fine line");
    });
}

function hasAging(profile) {
  return (profile.selectedFaceBodyConcerns || []).some((concern) => normLabel(concern) === "aging");
}

function skinColumn(profile) {
  const base = ["Oily", "Dry", "Normal", "Combination"].includes(profile.selectedSkinType)
    ? profile.selectedSkinType
    : "Normal";
  return `${base}${isSensitive(profile) ? "+Sensitive" : ""} Score`;
}

export function normalizedProductType(value) {
  const type = cleanText(value).toLowerCase();
  if (["moisturiser", "moisturizer", "cream", "lotion"].includes(type)) return "moisturizer";
  if (["cleanser", "wash", "body wash"].includes(type)) return "cleanser";
  if (type === "seru") return "serum";
  return type;
}

function productRule(product, profile) {
  const type = normalizedProductType(product.product_type);
  if (type === "cleanser" && hasAntiAgingConcern(profile)) {
    return { age: false, concern: false, skin: true, special: true };
  }
  if (type === "serum") return { age: true, concern: true, skin: false, special: true };
  if (["moisturizer", "sunscreen"].includes(type)) {
    return { age: true, concern: false, skin: true, special: true };
  }
  return { age: true, concern: true, skin: true, special: true };
}

function displayScore(value) {
  return Number.isInteger(value) ? Math.trunc(value) : value;
}

function roundedAverage(components) {
  const scores = components.map(({ score }) => Number(score));
  if (!scores.length) return 0;
  if (scores.some((score) => score <= -100)) return -100;
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return average >= 0 ? Math.floor(average + 0.5) : Math.ceil(average - 0.5);
}

function firstScore(product, columns) {
  for (const column of columns) {
    if (product.scores[column] != null) return [column, product.scores[column]];
  }
  return null;
}

function drynessScore(value) {
  if ([-100, 0, 100].includes(value)) return value;
  if (value <= 50) return -100;
  if (value <= 84) return 0;
  return 100;
}

function specialScores(product, conditions, useDefaultNone = true) {
  const selected = conditions.map(normLabel).filter(Boolean);
  if (!selected.length || (selected.length === 1 && selected[0] === "none")) {
    return useDefaultNone ? [["None", "None", 100]] : [];
  }

  const matches = [];
  if (selected.includes("pregnant")) {
    const pair = firstScore(product, ["Pregnancy Score", "Pregnancy safe"]);
    if (pair) matches.push(["Pregnancy", pair[0], pair[1]]);
  }
  if (selected.includes("breastfeeding")) {
    const pair = firstScore(product, ["Breastfeeling Score", "Breastfeeding safe"]);
    if (pair) matches.push(["Breastfeeding", pair[0], pair[1]]);
  }
  if (selected.includes("excessive dryness")) {
    const pair = firstScore(product, ["Excessive Dryness score"]);
    if (pair) matches.push(["Excessive Dryness", pair[0], drynessScore(pair[1])]);
  }
  return matches;
}

function productText(product) {
  return [
    product.product_name,
    product.single_hero_ingredient,
    product.secondary_hero_ingredients,
    product.ingredients,
  ].join(" ").toLowerCase();
}

function isRetinoid(product) {
  const text = productText(product);
  return ["retinol", "retinal", "retinoid", "retinyl", "tretinoin", "adapalene"]
    .some((token) => text.includes(token));
}

function serumIsNightOnly(product, profile) {
  if (normalizedProductType(product.product_type) !== "serum") return false;
  const specials = (profile.selectedSpecialConditions || []).map(normLabel);
  return specials.some((item) => ["pregnant", "breastfeeding"].includes(item))
    || isUnder16(profile)
    || isDryOrSensitive(profile);
}

function routineNotes(product, profile) {
  const notes = [];
  if (serumIsNightOnly(product, profile)) {
    notes.push("For this profile, suggest this serum only at night.");
  }
  if (isRetinoid(product)) {
    notes.push("Use only at night and pair with sunscreen the next morning.");
    if (
      hasAging(profile)
      || isUnder16(profile)
      || isDryOrSensitive(profile)
      || hasSpecialCondition(profile)
    ) {
      notes.push("Use the sandwich method: apply moisturiser before retinol and again after retinol.");
    }
  }
  return notes;
}

function matchLabel(score) {
  if (score >= 90) return "Excellent Match";
  if (score >= 80) return "Great Match";
  if (score >= 70) return "Good Match";
  if (score >= 50) return "Fits with Caution";
  return "Not Recommended";
}

function scoreProduct(product, profile) {
  const components = [];
  const reasons = [];
  const warnings = [];
  const rule = productRule(product, profile);

  const selectedAge = cleanText(profile.age);
  const agePairs = ageColumns(selectedAge)
    .filter((column) => product.scores[column] != null)
    .map((column) => [column, product.scores[column]]);
  if (rule.age && agePairs.length === 1) {
    const [column, score] = agePairs[0];
    components.push({ name: `Age ${column}`, score: displayScore(score), source_column: column });
    reasons.push(`Age fit ${column}: ${score}`);
  } else if (rule.age && agePairs.length > 1) {
    const score = roundedAverage(agePairs.map(([, value]) => ({ score: value })));
    components.push({
      name: `Age ${selectedAge}`,
      score,
      source_column: agePairs.map(([column]) => column).join(", "),
    });
    reasons.push(`Age fit ${selectedAge} via ${agePairs.map(([column, value]) => `${column}: ${value}`).join(", ")}`);
  }

  if (rule.concern) {
    const concerns = profile.selectedFaceBodyConcerns || [];
    for (const concern of concerns) {
      const columns = CONCERN_COLUMNS[normLabel(concern)] || [cleanText(concern)];
      const pair = firstScore(product, columns);
      if (pair) {
        components.push({ name: cleanText(concern), score: displayScore(pair[1]), source_column: pair[0] });
        reasons.push(`${cleanText(concern)} via ${pair[0]}: ${pair[1]}`);
      }
    }
    if (!concerns.length && product.scores.None != null) {
      components.push({ name: "General fit", score: displayScore(product.scores.None), source_column: "None" });
    }
  }

  if (rule.skin) {
    const column = skinColumn(profile);
    if (product.scores[column] != null) {
      components.push({ name: column, score: displayScore(product.scores[column]), source_column: column });
      reasons.push(`${column}: ${product.scores[column]}`);
    }
  }

  let specials = profile.selectedSpecialConditions || [];
  let useDefaultNone = true;
  if (normalizedProductType(product.product_type) === "serum") {
    const filtered = specials.filter((item) => normLabel(item) !== "excessive dryness");
    const skippedDryness = filtered.length !== specials.length;
    specials = filtered;
    useDefaultNone = !skippedDryness || filtered.map(normLabel).filter(Boolean).length > 0;
  }
  if (rule.special) {
    for (const [name, column, score] of specialScores(product, specials, useDefaultNone)) {
      components.push({ name, score: displayScore(score), source_column: column });
      reasons.push(`${name}: ${score}`);
      if (score < 0) warnings.push(`${name} has a hard-blocker score for this profile.`);
    }
  }

  const score = roundedAverage(components);
  const label = matchLabel(score);
  const hardBlockers = components.filter((component) => Number(component.score) <= -100);
  const used = components
    .slice(0, 6)
    .map((component) => `${component.name} [${component.source_column}]: ${component.score}`)
    .join("; ");
  let explanation;
  if (hardBlockers.length) {
    const blocked = hardBlockers
      .slice(0, 3)
      .map((component) => `${component.name} [${component.source_column}]: ${component.score}`)
      .join("; ");
    explanation = `${label}: this product has a hard blocker for this profile, so the final score is -100. Blocked by ${blocked}. Used ${used || "no matching score columns"}. Only products present in the live catalog CSV are returned.`;
    warnings.push("Hard blocker score found for this profile.");
  } else {
    const enabledRules = Object.entries(rule).filter(([, enabled]) => enabled).map(([name]) => name).join(", ");
    explanation = `${label}: score is the rounded average of applicable catalog scores for this profile. Used ${used || "no matching score columns"}. Product-type rule: ${cleanText(product.product_type) || "Unknown"} uses ${enabledRules} components. Only products present in the live catalog CSV are returned.`;
  }
  if (warnings.length) explanation = `${warnings[0]} ${explanation}`;

  return {
    product_uid: product.product_uid,
    score_uid: product.product_uid,
    product_name: product.product_name,
    brand_name: product.brand_name,
    category: product.category,
    product_type: product.product_type,
    score,
    match_label: label,
    explanation,
    source_sheet: product.source_sheet,
    hero_ingredient: product.single_hero_ingredient,
    secondary_hero_ingredients: product.secondary_hero_ingredients,
    size: product.sku_size,
    mrp: product.mrp,
    selling_price: product.sp,
    base_when_to_use: product.when_to_use,
    when_to_use: serumIsNightOnly(product, profile) || isRetinoid(product)
      ? "Night"
      : product.when_to_use || "Morning and Night",
    dos: product.dos,
    donts: product.donts,
    addresses_skin_concerns: product.addresses_skin_concerns,
    ingredient_cautions: product.ingredient_cautions,
    usage_instructions: product.usage_instructions,
    ingredients: product.ingredients,
    routine_notes: routineNotes(product, profile),
    image: product.image,
    component_scores: components,
    score_basis: "product_type_rule_with_hard_blocker_or_rounded_average",
    score_reasons: reasons,
    warnings,
  };
}

function thresholdCounts(products) {
  return Object.fromEntries(
    THRESHOLDS.map((threshold) => [
      `above_${threshold}`,
      products.filter(({ score }) => score >= threshold).length,
    ]),
  );
}

function summarize(products) {
  const categories = {};
  const productTypes = {};
  for (const product of products) {
    categories[product.category] = (categories[product.category] || 0) + 1;
    productTypes[product.product_type] = (productTypes[product.product_type] || 0) + 1;
  }
  return {
    excellent_count: products.filter(({ score }) => score >= 90).length,
    great_or_better_count: products.filter(({ score }) => score >= 80).length,
    good_or_better_count: products.filter(({ score }) => score >= 70).length,
    caution_or_better_count: products.filter(({ score }) => score >= 50).length,
    threshold_counts: thresholdCounts(products),
    categories,
    product_types: productTypes,
    top_score: products[0]?.score ?? null,
    bottom_score: products.at(-1)?.score ?? null,
  };
}

function numberPrice(value) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const number = Number(cleaned);
  return cleaned && Number.isFinite(number) ? number : null;
}

function effectivePrice(product) {
  return numberPrice(product.selling_price) || numberPrice(product.mrp);
}

function productSearchText(product) {
  return [
    product.product_name,
    product.product_type,
    product.hero_ingredient,
    product.secondary_hero_ingredients,
    product.ingredients,
  ].join(" ").toLowerCase();
}

function matchesSlot(product, slot) {
  const type = normalizedProductType(product.product_type);
  const rawType = cleanText(product.product_type).toLowerCase();
  const text = productSearchText(product);
  if (slot === "cleanser") return type === "cleanser";
  if (slot === "serum") return type === "serum";
  if (slot === "moisturiser") return type === "moisturizer" || ["body lotion", "body cream"].includes(rawType);
  if (slot === "sunscreen") return type === "sunscreen" || text.includes("sunscreen") || text.includes("spf");
  return false;
}

const routineSlots = {
  am: [["cleanser", "Cleanser"], ["moisturiser", "Moisturiser"], ["sunscreen", "Sunscreen"]],
  pm: [["serum", "Serum"], ["moisturiser", "Moisturiser"], ["cleanser", "Cleanser"]],
};

const routineTiers = {
  premium: {
    label: "Premium",
    description: "Score 90+ and effective price above Rs. 1000.",
    matches: (product) => product.score >= 90 && effectivePrice(product) > 1000,
  },
  value_fit: {
    label: "Value Fit",
    description: "Best score with effective price below Rs. 1000.",
    matches: (product) => {
      const value = effectivePrice(product);
      return value !== null && value < 1000;
    },
  },
};

function buildRoutine(products) {
  const routine = {
    tiers: {},
    missing_slots: [],
    selection_basis: "highest_scored_product_per_routine_slot_from_current_profile_results_with_price_tiers_and_top_two_weekly_masks",
  };
  for (const [tierKey, tier] of Object.entries(routineTiers)) {
    const payload = { label: tier.label, description: tier.description, am: [], pm: [] };
    for (const [period, slots] of Object.entries(routineSlots)) {
      for (const [slot, label] of slots) {
        const product = products.find((item) => matchesSlot(item, slot) && tier.matches(item)) || null;
        payload[period].push({ tier: tierKey, period, slot, label, product });
        if (!product) routine.missing_slots.push({ tier: tierKey, period, slot, label });
      }
    }
    routine.tiers[tierKey] = payload;
  }

  const seen = new Set();
  const masks = products.filter((product) => {
    const key = normKey(product.product_uid || product.product_name);
    const text = productSearchText(product);
    const isMask = cleanText(product.product_type).toLowerCase().includes("mask")
      || cleanText(product.product_type).toLowerCase().includes("masque")
      || text.includes("mask")
      || text.includes("masque");
    if (!isMask || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);

  routine.weekly = [0, 1].map((index) => {
    const item = {
      period: "weekly",
      slot: `mask_${index + 1}`,
      label: `Best Mask ${index + 1}`,
      product: masks[index] || null,
    };
    if (!item.product) routine.missing_slots.push({ period: item.period, slot: item.slot, label: item.label });
    return item;
  });
  routine.am = routine.tiers.premium.am;
  routine.pm = routine.tiers.premium.pm;
  return routine;
}

function sortProducts(a, b) {
  if (a.score !== b.score) return b.score - a.score;
  if (a.category !== b.category) return a.category < b.category ? -1 : 1;
  const left = a.product_name.toLowerCase();
  const right = b.product_name.toLowerCase();
  return left === right ? 0 : left < right ? -1 : 1;
}

export async function recommend(input = {}, requestedLimit = 500) {
  const [profile, profileAdjustments] = sanitizeProfile(input);
  const catalog = await loadProducts();
  const sorted = catalog.map((product) => {
    const scored = scoreProduct(product, profile);
    if (profileAdjustments.length) scored.warnings = [...profileAdjustments, ...scored.warnings];
    return scored;
  }).sort(sortProducts);
  const limit = Math.max(1, Math.min(Number(requestedLimit) || 500, 1000));
  const products = sorted.slice(0, limit);
  return {
    profile,
    input_profile: input,
    profile_adjustments: profileAdjustments,
    target_sheets: ["Face and body"],
    total_matches: sorted.length,
    returned: products.length,
    summary: summarize(products),
    routine: buildRoutine(sorted),
    products,
  };
}

export async function routine(profile, limit = 1000) {
  const response = await recommend(profile, limit);
  return {
    profile: response.profile,
    input_profile: response.input_profile,
    profile_adjustments: response.profile_adjustments,
    target_sheets: response.target_sheets,
    total_matches: response.total_matches,
    returned: response.returned,
    routine: response.routine,
  };
}

export async function health() {
  const products = await loadProducts();
  return {
    data_source: "supabase:roopsee_products",
    catalog_products: products.length,
    score_rows: products.length,
    score_rows_by_sheet: { "Face and body": products.length },
    catalog_missing_score_count: products.filter((product) => !Object.keys(product.scores).length).length,
    catalog_missing_score: products.filter((product) => !Object.keys(product.scores).length).map((product) => product.product_uid),
    score_only_count: 0,
    score_only_uids: [],
  };
}

function coverageStatus(profile, summary) {
  const lipsEyeOnly = Boolean(profile.selectedLipsEyesConcerns?.length)
    && !profile.selectedFaceBodyConcerns?.length;
  if (lipsEyeOnly) {
    if (summary.good_or_better_count >= 4 && summary.great_or_better_count >= 2) return "Strong";
    if (summary.good_or_better_count >= 2) return "Limited but usable";
    return "Coverage gap";
  }
  if (summary.good_or_better_count >= 12 && summary.great_or_better_count >= 5) return "Strong";
  if (summary.good_or_better_count >= 8 && summary.great_or_better_count >= 3) return "Usable";
  return "Coverage gap";
}

export async function coverage(profiles, topN = 12) {
  const rows = await Promise.all(profiles.map(async (profile, index) => {
    const response = await recommend(profile, 1000);
    const counts = thresholdCounts(response.products);
    return {
      profile_id: `profile_${String(index + 1).padStart(3, "0")}`,
      profile,
      scoring_profile: response.profile,
      status: coverageStatus(response.profile, response.summary),
      total_matches: response.total_matches,
      excellent_count: response.summary.excellent_count,
      great_or_better_count: response.summary.great_or_better_count,
      good_or_better_count: response.summary.good_or_better_count,
      threshold_counts: counts,
      above_90: counts.above_90,
      above_80: counts.above_80,
      above_70: counts.above_70,
      above_60: counts.above_60,
      above_50: counts.above_50,
      top_products: response.products.slice(0, topN),
      target_sheets: response.target_sheets,
    };
  }));
  const statusCounts = {};
  for (const row of rows) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  const [products, healthSummary] = await Promise.all([loadProducts(), health()]);
  return {
    profile_count: rows.length,
    status_counts: statusCounts,
    catalog_products: products.length,
    catalog_missing_score_count: healthSummary.catalog_missing_score_count,
    rows,
  };
}

export async function optionsPayload(coverageModes) {
  return { quiz_options: QUIZ_OPTIONS, coverage_modes: coverageModes, health: await health() };
}
