// Links a Roopsee catalog product (data/products.csv) to rows in the
// `retailer_products` table.
//
// There is no join key to work with: barely 1% of retailer rows carry a gtin.
// So the match is inferred from brand + strength + size + name similarity, and
// the rules below are deliberately strict. Concentration is the whole point of
// most skincare SKUs — "Retinol 0.3%" and "Retinol 0.6%" are different products
// at different prices — so a mismatch there is worse than showing nothing at
// all. Every rule here is a hard requirement; when one fails we return no match
// and the caller renders nothing.

const NAME_SIMILARITY_FLOOR = 0.55;

export function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9.%+]+/g, " ").trim();
}

// "0.6%", "10 %", "2.5%" -> [0.6], [10], [2.5]
export function strengths(text) {
  const found = String(text || "").match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  return [...new Set(found.map((item) => Number(item.replace(/[^\d.]/g, ""))))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

// "30ml", "50 ML", "100 g", "1.7 oz" -> normalized {amount, unit} pairs in ml/g
export function sizes(text) {
  const found = String(text || "").match(/(\d+(?:\.\d+)?)\s*(ml|l|g|gm|gms|gram|grams|kg|oz)\b/gi) || [];
  const parsed = found.map((item) => {
    const amount = Number(item.replace(/[^\d.]/g, ""));
    const unit = item.replace(/[\d.\s]/g, "").toLowerCase();
    if (!Number.isFinite(amount)) return null;
    if (unit === "l") return `${amount * 1000}ml`;
    if (unit === "kg") return `${amount * 1000}g`;
    if (unit === "oz") return `${Math.round(amount * 29.5735)}ml`;
    if (["g", "gm", "gms", "gram", "grams"].includes(unit)) return `${amount}g`;
    return `${amount}ml`;
  });
  return [...new Set(parsed.filter(Boolean))].sort();
}

function meaningfulTokens(text) {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

const STOP_WORDS = new Set([
  "for", "with", "and", "the", "new", "pack", "combo", "free", "skin", "face",
  "care", "beauty", "product", "ml", "gm",
]);

export function nameSimilarity(left, right) {
  const a = meaningfulTokens(left);
  const b = meaningfulTokens(right);
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / new Set([...a, ...b]).size;
}

// Two sets agree when they are equal, or when one side simply did not publish
// the attribute. A stated 0.3% never matches a stated 0.6%.
function attributesAgree(left, right) {
  if (!left.length || !right.length) return true;
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function catalogFacts(product) {
  const text = `${product.product_name} ${product.sku_size || ""}`;
  return {
    brand: normalize(product.brand_name),
    name: product.product_name,
    strengths: strengths(product.product_name),
    sizes: sizes(text),
  };
}

// Amazon packs its listing titles with marketing copy after the product name,
// pipe-delimited and averaging 4.4 segments — "Dr. Sheth's ... Sunscreen |
// SPF 50+ PA++++ | With 2% Vitamin C Complex | In-Vivo Tested | ...". That tail
// roughly doubles the title length and buries the real name, which sinks token
// similarity below the floor even when the product genuinely matches. Only the
// first segment names the product. Nykaa and Tira barely use pipes (1% and 0%),
// so this is safe to apply everywhere.
export function canonicalName(name) {
  const first = String(name || "").split("|")[0].trim();
  return first || String(name || "").trim();
}

// A 2-pack is a different purchase at a different price — never compare it
// against a single unit.
export function isMultipack(row) {
  return /pack\s+of\s+(?!1\b)\d+/i.test(`${row.product_name} ${row.variant || ""}`);
}

function retailerFacts(row) {
  const name = canonicalName(row.product_name);
  // The variant column states size most reliably ("50 g (Pack of 1)"); fall
  // back to the name, and only then to the marketing tail we just stripped.
  const sizeSources = [row.variant, name, row.product_name];
  const foundSizes = sizeSources.map(sizes).find((found) => found.length) || [];

  return {
    brand: normalize(row.brand),
    name,
    strengths: strengths(name),
    sizes: foundSizes,
  };
}

// Returns a confidence score, or null when any hard requirement fails.
export function matchConfidence(product, row) {
  if (isMultipack(row)) return null;

  const left = catalogFacts(product);
  const right = retailerFacts(row);

  if (!left.brand || left.brand !== right.brand) return null;
  if (!attributesAgree(left.strengths, right.strengths)) return null;
  if (!attributesAgree(left.sizes, right.sizes)) return null;

  const similarity = nameSimilarity(left.name, right.name);
  if (similarity < NAME_SIMILARITY_FLOOR) return null;

  // Prefer rows that actually stated the attributes we checked, so a row that
  // explicitly agrees on 0.6% outranks one that just never mentioned a strength.
  const statedStrength = left.strengths.length && right.strengths.length ? 0.1 : 0;
  const statedSize = left.sizes.length && right.sizes.length ? 0.05 : 0;
  return similarity + statedStrength + statedSize;
}

// Best matching row per site. Sites with no confident match are omitted.
export function bestOfferPerSite(product, rows) {
  const best = new Map();

  for (const row of rows) {
    const confidence = matchConfidence(product, row);
    if (confidence === null) continue;

    const current = best.get(row.site);
    if (!current || confidence > current.confidence) {
      best.set(row.site, { ...row, confidence });
    }
  }

  return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}
