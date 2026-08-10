import fs from "node:fs";
import path from "node:path";
import { FACE_SHEET, SCORE_COLUMNS } from "./constants";

export function cleanText(value) {
  return value == null ? "" : String(value).replaceAll("\u00a0", " ").trim().replace(/\s+/g, " ");
}

export function normLabel(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normKey(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function firstImage(value) {
  const raw = cleanText(value);
  if (!raw) return "";
  let candidate = "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) candidate = cleanText(parsed[0]);
  } catch {
    // The catalog also stores comma- and space-separated URL lists.
  }
  if (!candidate) {
    const urls = raw.match(/https?:\/\/\S+/g);
    candidate = urls?.[0]?.replace(/,$/, "") || raw.split(",")[0].trim();
  }
  // Guard against junk like a bare "https://" with no host, which crashes next/image's URL parsing.
  return /^https?:\/\/\S+/.test(candidate) ? candidate : "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.replace(/^\uFEFF/, "")) || [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function numberOrNull(value) {
  if (cleanText(value) === "") return null;
  const number = Number(String(value).replace("%", "").trim());
  return Number.isFinite(number) ? number : null;
}

let cachedProducts;

export function loadProducts() {
  if (cachedProducts) return cachedProducts;

  const csvPath = path.join(process.cwd(), "data", "products.csv");
  const source = fs.readFileSync(csvPath, "utf8");
  cachedProducts = parseCsv(source)
    .filter((row) => cleanText(row.product_uid) && cleanText(row.product_name))
    .map((row, index) => {
      const scores = {};
      for (const column of SCORE_COLUMNS) {
        const score = numberOrNull(row[column]);
        if (score !== null) scores[column] = score;
      }
      if (scores["Above 25"] != null) scores["+>25"] = scores["Above 25"];

      return {
        source_sheet: FACE_SHEET,
        source_row: index + 2,
        product_uid: cleanText(row.product_uid),
        product_name: cleanText(row.product_name),
        brand_name: cleanText(row.brand_name),
        category: cleanText(row.category),
        product_type: cleanText(row.product_type),
        addresses_skin_concerns: cleanText(row.addresses_skin_concerns),
        sku_size: cleanText(row.sku_size),
        mrp: cleanText(row.mrp),
        sp: cleanText(row.sp),
        single_hero_ingredient: cleanText(row.single_hero_ingredient),
        secondary_hero_ingredients: cleanText(row.secondary_hero_ingredients),
        dos: cleanText(row.dos),
        donts: cleanText(row.donts),
        storage_instructions: cleanText(row.storage_instructions),
        usage_instructions: cleanText(row.usage_instructions),
        when_to_use: cleanText(row.when_to_use),
        ingredient_cautions: cleanText(row.ingredient_cautions),
        product_description: cleanText(row.product_description),
        ingredients: cleanText(row.ingredients),
        image: firstImage(row.images),
        database_id: cleanText(row.id),
        scores,
      };
    });

  return cachedProducts;
}

export function findProduct(productUid) {
  const wantedKey = normKey(decodeURIComponent(productUid || ""));
  return loadProducts().find((product) => normKey(product.product_uid) === wantedKey) || null;
}
