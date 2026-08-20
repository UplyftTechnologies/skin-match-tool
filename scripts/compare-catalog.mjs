// One-off comparison: how many data/products.csv rows have a matching row
// in the Supabase `retailer_products` table? Not part of the app build.
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const text = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return env;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field); field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((v) => v !== "")) rows.push(row);
      row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift()?.map((h) => h.replace(/^﻿/, "")) || [];
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

function normalizedProductName(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s*[([]?\s*\d+(?:\.\d+)?\s*(?:ml|millilitres?|l|ltr|litres?|g|gm|grams?|kg)\s*[)\]]?\s*$/i, "")
    .toLowerCase()
    .replace(/\band\b/g, "&")
    .replace(/[^a-z0-9%&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedBrand(name) {
  return normalizedProductName(name);
}

const IGNORED_TOKENS = new Set([
  "&", "a", "all", "and", "for", "in", "of", "skin", "the", "type", "with",
  "tested", "test", "dermatologically", "clinically", "new", "original",
]);

function coreTokens(name, brand) {
  const brandTokens = new Set(normalizedBrand(brand).split(" ").filter(Boolean));
  return new Set(
    normalizedProductName(name)
      .split(" ")
      .filter((token) => token && !IGNORED_TOKENS.has(token) && !brandTokens.has(token)),
  );
}

function tokenCoverage(aTokens, bTokens) {
  const shared = [...aTokens].filter((t) => bTokens.has(t)).length;
  const smaller = Math.min(aTokens.size, bTokens.size);
  return smaller ? shared / smaller : 0;
}

async function fetchAllRetailerProducts(env) {
  const rows = [];
  const pageSize = 1000;
  const baseUrl = `${env.ROOPSEE_NEXT_PUBLIC_SUPABASE_URL}/rest/v1/retailer_products`;
  const columns = "id,site,brand,product_name,sku,categories,mrp,selling_price";
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const res = await fetch(`${baseUrl}?select=${columns}`, {
      headers: {
        apikey: env.ROOPSEE_SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.ROOPSEE_SUPABASE_SERVICE_KEY}`,
        Range: `${from}-${to}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const env = loadEnv();

  const csvText = fs.readFileSync(path.join(process.cwd(), "data", "products.csv"), "utf8");
  const csvRows = parseCsv(csvText)
    .filter((r) => r.product_uid && r.product_name)
    .map((r) => ({
      product_uid: r.product_uid,
      product_name: r.product_name,
      brand_name: r.brand_name,
      brandKey: normalizedBrand(r.brand_name),
      nameKey: normalizedProductName(r.product_name),
      tokens: coreTokens(r.product_name, r.brand_name),
    }));

  console.log(`CSV products: ${csvRows.length}`);

  const retailerRows = await fetchAllRetailerProducts(env);
  console.log(`Supabase retailer_products rows: ${retailerRows.length}`);

  const retailerByBrand = new Map();
  const retailerRowsIndexed = [];
  for (const row of retailerRows) {
    const brandKey = normalizedBrand(row.brand);
    const nameKey = normalizedProductName(row.product_name);
    const tokens = coreTokens(row.product_name, row.brand);
    const entry = { ...row, brandKey, nameKey, tokens };
    if (!retailerByBrand.has(brandKey)) retailerByBrand.set(brandKey, []);
    retailerByBrand.get(brandKey).push(entry);
    retailerRowsIndexed.push(entry);
  }

  const exactMatches = [];
  const fuzzyMatches = [];
  const noMatch = [];

  for (const csvRow of csvRows) {
    const sameBrandCandidates = retailerByBrand.get(csvRow.brandKey) || [];
    const exact = sameBrandCandidates.find((c) => c.nameKey === csvRow.nameKey);
    if (exact) {
      exactMatches.push({ csv: csvRow, retailer: exact });
      continue;
    }

    // Same-brand-string candidates only. A brand-agnostic pass was tried and
    // rejected: with brand tokens stripped, generic skincare vocabulary
    // (SPF 50 PA++++, Vitamin C Face Serum, Niacinamide...) causes token
    // overlap between completely unrelated products, producing false matches.
    let best = null;
    let bestScore = 0;
    for (const candidate of sameBrandCandidates) {
      const score = tokenCoverage(csvRow.tokens, candidate.tokens);
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    if (best && bestScore >= 0.7 && [...csvRow.tokens].filter((t) => best.tokens.has(t)).length >= 2) {
      fuzzyMatches.push({ csv: csvRow, retailer: best, score: bestScore, matchType: "same_brand" });
    } else {
      noMatch.push(csvRow);
    }
  }

  console.log(`Exact name+brand matches: ${exactMatches.length}`);
  console.log(`Fuzzy matches (token coverage >= 0.7): ${fuzzyMatches.length}`);
  console.log(`Total matched: ${exactMatches.length + fuzzyMatches.length}`);
  console.log(`CSV products with no match in retailer_products: ${noMatch.length}`);

  const brandsInCsv = new Set(csvRows.map((r) => r.brandKey));
  const brandsInRetailer = new Set(retailerRows.map((r) => normalizedBrand(r.brand)));
  const brandsShared = [...brandsInCsv].filter((b) => brandsInRetailer.has(b));
  console.log(`\nDistinct brands in CSV: ${brandsInCsv.size}`);
  console.log(`Distinct brands in retailer_products: ${brandsInRetailer.size}`);
  console.log(`Brands present in both: ${brandsShared.length}`);

  console.log("\nAll matched pairs:");
  for (const m of [...exactMatches.map((m) => ({ ...m, matchType: "exact" })), ...fuzzyMatches]) {
    console.log(`  [${m.matchType}] CSV ${m.csv.product_uid} "${m.csv.brand_name} ${m.csv.product_name}"`);
    console.log(`      -> retailer #${m.retailer.id} (${m.retailer.site}) "${m.retailer.brand} ${m.retailer.product_name}"${m.score ? ` score=${m.score.toFixed(2)}` : ""}`);
  }

  fs.writeFileSync(
    path.join(process.cwd(), "outputs", "catalog-comparison.json"),
    JSON.stringify(
      {
        csv_total: csvRows.length,
        retailer_total: retailerRows.length,
        exact_matches: exactMatches.length,
        fuzzy_matches: fuzzyMatches.length,
        total_matched: exactMatches.length + fuzzyMatches.length,
        unmatched_csv: noMatch.length,
        brands_in_csv: brandsInCsv.size,
        brands_in_retailer: brandsInRetailer.size,
        brands_shared: brandsShared.length,
        exact_match_pairs: exactMatches.map((m) => ({
          csv_product_uid: m.csv.product_uid,
          csv_product_name: m.csv.product_name,
          retailer_id: m.retailer.id,
          retailer_site: m.retailer.site,
        })),
        fuzzy_match_pairs: fuzzyMatches.map((m) => ({
          csv_product_uid: m.csv.product_uid,
          csv_product_name: m.csv.product_name,
          csv_brand: m.csv.brand_name,
          retailer_id: m.retailer.id,
          retailer_site: m.retailer.site,
          retailer_brand: m.retailer.brand,
          retailer_product_name: m.retailer.product_name,
          score: m.score,
          match_type: m.matchType,
        })),
        unmatched_csv_products: noMatch.map((r) => ({
          product_uid: r.product_uid,
          product_name: r.product_name,
          brand_name: r.brand_name,
        })),
      },
      null,
      2,
    ),
  );
  console.log("\nFull report written to outputs/catalog-comparison.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
