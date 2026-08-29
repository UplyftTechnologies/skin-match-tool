// Loads the trimmed scoring dataset and indexes it for joining onto
// retailer_products.
//
// The 16MB file is produced by scripts/build-scoring-dataset.mjs from the 31MB
// src/coverage_tool_files/final_scored_products.json. Re-run that script when
// the source dataset changes.
import fs from "node:fs";
import path from "node:path";

const DATASET_PATH = path.join(process.cwd(), "src", "lib", "scoring", "scored-products.json");

/**
 * The join key back to the scoring dataset. Host plus path only — query
 * strings and trailing slashes differ between the scrape that built the
 * dataset and the live table.
 *
 * This must stay byte-identical to urlKey() in
 * scripts/build-scoring-dataset.mjs, including keeping the "www." prefix: the
 * two sides are compared as plain strings, so any normalisation applied here
 * and not there silently drops the whole join to zero.
 */
export function retailerUrlKey(value) {
  try {
    const url = new URL(String(value).trim());
    return (url.host + url.pathname).toLowerCase().replace(/\/$/, "");
  } catch {
    return "";
  }
}

// Held on globalThis, not in module scope. Next bundles instrumentation,
// route handlers and server components separately, so a module-scope cache
// is filled once per bundle — the startup warm-up populated its own copy
// and the API route still paid the full read on its first request.
const CACHE_KEY = Symbol.for("__roopseeScoringDataset");

/**
 * Parsed once per server process. The engine reads it on every scoring pass,
 * so it is deliberately a synchronous read at first use rather than a promise
 * every caller has to thread through.
 */
export function SCORED_DATASET() {
  const shared = globalThis[CACHE_KEY];
  if (shared) return shared;

  const raw = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));

  const scoreColumnIndex = {};
  (raw.scoreColumns || []).forEach((column, index) => {
    scoreColumnIndex[column] = index;
  });

  // The ported scoring block reads product.scoreLayers and rebuilds its own
  // search text from several fields. The trim collapsed both — layers moved to
  // `layers`, and the text was pre-joined into `text`. Adapting here keeps the
  // ported block untouched, which is the point: it is copied verbatim from
  // app.js and must not be edited to fit a different field name.
  const products = (raw.products || []).map((product) => ({
    ...product,
    scoreLayers: product.layers,
    // productSearchText() joins name + brand + ingredients and lowercases the
    // result; feeding the pre-joined text through one of those slots produces
    // the same haystack for the keyword `includes` tests that read it.
    primaryIngredients: product.text,
  }));

  const byUrlKey = new Map();
  for (const product of products) {
    if (product.urlKey && !byUrlKey.has(product.urlKey)) byUrlKey.set(product.urlKey, product);
  }

  const cache = {
    products,
    byUrlKey,
    scoreColumns: raw.scoreColumns || [],
    scoreColumnIndex,
    visibleScoreWeights: raw.visibleScoreWeights,
    rankFusionWeights: raw.rankFusionWeights,
    generatedAt: raw.generatedAt,
    sourceGeneratedAt: raw.sourceGeneratedAt,
  };
  globalThis[CACHE_KEY] = cache;
  return cache;
}
