// Trims final_scored_products.json down to the fields the scoring engine reads.
//
// The source file is 31MB, most of it prose the scorer never touches — raw
// ingredient text, review counts, image urls, doctor-anchor detail. The engine
// needs the five score layers, the support counts, the families and enough text
// for the cleanser cue test. Trimming keeps the server-side cache affordable.
//
//   node scripts/build-scoring-dataset.mjs
import fs from "node:fs";
import path from "node:path";

const SOURCE = path.join(process.cwd(), "src/coverage_tool_files/final_scored_products.json");
const TARGET = path.join(process.cwd(), "src/lib/scoring/scored-products.json");

const raw = JSON.parse(fs.readFileSync(SOURCE, "utf8"));

// hasActiveCleanserCue / hasComfortCleanserCue scan this text for keyword
// markers, so it has to survive the trim — but only lowercased and joined,
// never the original fields.
function searchText(product) {
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

// The join key back to retailer_products. Host plus path only: query strings
// and trailing slashes differ between the scrape that built this file and the
// live table.
function urlKey(value) {
  try {
    const url = new URL(String(value).trim());
    return (url.host + url.pathname).toLowerCase().replace(/\/$/, "");
  } catch {
    return "";
  }
}

const products = raw.products.map((product) => ({
  uid: product.uid,
  urlKey: urlKey(product.productUrl),
  name: product.name,
  category: product.category,
  normalizedType: product.normalizedType,
  families: product.families || [],
  confidence: product.confidence,
  support: {
    anchor: product.support?.anchor || 0,
    exact: product.support?.exact || 0,
    family: product.support?.family || 0,
    typeFamily: product.support?.typeFamily || 0,
    type: product.support?.type || 0,
  },
  text: searchText(product),
  layers: {
    baseline: product.scoreLayers?.baseline || null,
    v2: product.scoreLayers?.v2 || null,
    anchor: product.scoreLayers?.anchor || null,
    typeFamily: product.scoreLayers?.typeFamily || null,
    type: product.scoreLayers?.type || null,
  },
}));

const output = {
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: raw.metadata.generatedAt,
  scoreColumns: raw.scoreColumns,
  visibleScoreWeights: raw.metadata.visibleScoreWeights,
  rankFusionWeights: raw.metadata.rankFusionWeights,
  products,
};

fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, JSON.stringify(output));

const before = (fs.statSync(SOURCE).size / 1048576).toFixed(1);
const after = (fs.statSync(TARGET).size / 1048576).toFixed(1);
const withUrl = products.filter((product) => product.urlKey).length;
console.log(`products      : ${products.length}`);
console.log(`with url key  : ${withUrl}`);
console.log(`size          : ${before}MB -> ${after}MB`);
