import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiChevronDown,
  FiDroplet,
  FiExternalLink,
  FiFileText,
  FiInfo,
  FiShield,
  FiStar,
  FiTag,
} from "react-icons/fi";
import Header from "@/components/header";
import RetailerProductGallery from "@/components/retailer-product-gallery";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildSizeOptions, isSizeSibling } from "@/lib/variant-sizes";
import { canonicalCategory } from "@/lib/retailer-catalog";
import { detectRestrictedActives } from "@/lib/scoring/ingredient-safety";
import RetailerSimilarProducts from "@/components/retailer-similar-products";
import RetailerProductPlayground from "@/components/retailer-product-playground";
import TypicalPriceRange from "@/components/typical-price-range";
import RetailerLogo, { siteName } from "@/components/retailer-logo";

export const dynamic = "force-dynamic";

const getProduct = cache(async (id) => {
  if (!/^\d+$/.test(id)) return null;

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch retailer product:", error.message);
    return null;
  }

  return data;
});

function normalizedProductName(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s*[([]?\s*\d+(?:\.\d+)?\s*(?:ml|millilitres?|l|ltr|litres?|g|gm|grams?|kg)\s*[)\]]?\s*$/i, "")
    .toLowerCase()
    .replace(/\band\b/g, "&")
    .replace(/[^a-z0-9%&]+/g, " ")
    .trim();
}

function canonicalSize(value) {
  const match = String(value || "")
    .toLowerCase()
    .match(/(\d+(?:\.\d+)?)\s*(ml|millilitres?|l|ltr|litres?|g|gm|grams?|kg)\b/);

  if (!match) return "";
  let amount = Number(match[1]);
  let unit = match[2];

  if (["l", "ltr", "litre", "litres"].includes(unit)) {
    amount *= 1000;
    unit = "ml";
  } else if (unit === "kg") {
    amount *= 1000;
    unit = "g";
  } else if (["millilitre", "millilitres"].includes(unit)) {
    unit = "ml";
  } else if (["gm", "gram", "grams"].includes(unit)) {
    unit = "g";
  }

  return `${amount}${unit}`;
}

function modelCodes(name) {
  const codes = new Set();
  const pattern = /\b([a-z]{1,4})[-\s]?(\d{2,5})\b/gi;
  let match;

  while ((match = pattern.exec(String(name || ""))) !== null) {
    const prefix = match[1].toLowerCase();
    if (!["spf", "pa"].includes(prefix)) {
      codes.add(`${prefix}${match[2]}`);
    }
  }

  return codes;
}

function coreNameTokens(name, brand) {
  const ignored = new Set([
    "&", "a", "all", "and", "for", "in", "of", "skin", "the", "type", "vivo", "with",
    "tested", "test", "dermatologically", "clinically", "new", "original",
  ]);
  const brandTokens = new Set(normalizedProductName(brand).split(/\s+/).filter(Boolean));

  return new Set(
    normalizedProductName(name)
      .split(/\s+/)
      .filter((token) => token && !ignored.has(token) && !brandTokens.has(token)),
  );
}

function nameSimilarity(current, candidate) {
  const currentTokens = coreNameTokens(current.product_name, current.brand);
  const candidateTokens = coreNameTokens(candidate.product_name, current.brand);
  const sharedCount = [...currentTokens]
    .filter((token) => candidateTokens.has(token)).length;
  const smallerSetSize = Math.min(currentTokens.size, candidateTokens.size);
  const combinedSetSize = new Set([...currentTokens, ...candidateTokens]).size;

  return {
    sharedCount,
    coverage: smallerSetSize ? sharedCount / smallerSetSize : 0,
    jaccard: combinedSetSize ? sharedCount / combinedSetSize : 0,
  };
}

function numericSignature(name) {
  return (normalizedProductName(name).match(/\b\d+(?:\.\d+)?/g) || []).join(":");
}

function categoryOverlap(current, candidate) {
  const currentCategories = new Set(
    (current.categories || []).map((category) => category.toLowerCase()),
  );
  return (candidate.categories || [])
    .some((category) => currentCategories.has(category.toLowerCase()));
}

function hasSimilarMrp(current, candidate) {
  const currentMrp = Number(current.mrp);
  const candidateMrp = Number(candidate.mrp);
  if (!Number.isFinite(currentMrp) || !Number.isFinite(candidateMrp)) return false;
  if (currentMrp <= 0 || candidateMrp <= 0) return false;

  return Math.abs(currentMrp - candidateMrp) / Math.max(currentMrp, candidateMrp) <= 0.1;
}

function textTokenSimilarity(left, right) {
  const leftTokens = new Set(
    String(left || "").toLowerCase().match(/[a-z0-9]+/g) || [],
  );
  const rightTokens = new Set(
    String(right || "").toLowerCase().match(/[a-z0-9]+/g) || [],
  );
  if (!leftTokens.size || !rightTokens.size) return 0;

  const sharedCount = [...leftTokens]
    .filter((token) => rightTokens.has(token)).length;
  return sharedCount / new Set([...leftTokens, ...rightTokens]).size;
}

function supportingConfidence(current, candidate) {
  let confidence = 0;
  if (categoryOverlap(current, candidate)) confidence += 0.08;
  if (hasSimilarMrp(current, candidate)) confidence += 0.08;
  if (textTokenSimilarity(current.ingredients, candidate.ingredients) >= 0.5) {
    confidence += 0.09;
  }
  return confidence;
}

function isSameProduct(current, candidate) {
  const currentSize = canonicalSize(current.variant) || canonicalSize(current.product_name);
  const candidateSize = canonicalSize(candidate.variant) || canonicalSize(candidate.product_name);
  if (currentSize !== candidateSize) return false;

  if (normalizedProductName(current.product_name) === normalizedProductName(candidate.product_name)) {
    return true;
  }

  const currentCodes = modelCodes(current.product_name);
  const candidateCodes = modelCodes(candidate.product_name);
  const hasSharedModelCode = [...currentCodes]
    .some((code) => candidateCodes.has(code));
  const hasAnyModelCode = currentCodes.size > 0 || candidateCodes.size > 0;
  const similarity = nameSimilarity(current, candidate);
  const nameConfidence = (similarity.coverage * 0.6) + (similarity.jaccard * 0.4);
  const confidence = nameConfidence + supportingConfidence(current, candidate);

  if (hasAnyModelCode) {
    return hasSharedModelCode
      && similarity.sharedCount >= 3
      && similarity.coverage >= 0.65
      && similarity.jaccard >= 0.45
      && confidence >= 0.72;
  }

  const currentNumbers = numericSignature(current.product_name);
  const candidateNumbers = numericSignature(candidate.product_name);
  if (currentNumbers !== candidateNumbers) return false;

  const strictNameMatch = similarity.sharedCount >= 4
    && similarity.coverage >= 0.8
    && similarity.jaccard >= 0.65;
  const ingredientBackedMatch = textTokenSimilarity(
    current.ingredients,
    candidate.ingredients,
  ) >= 0.75
    && similarity.sharedCount >= 4
    && similarity.coverage >= 0.7
    && similarity.jaccard >= 0.5;
  const metadataBackedMatch = categoryOverlap(current, candidate)
    && hasSimilarMrp(current, candidate)
    && similarity.sharedCount >= 5
    && similarity.coverage >= 0.75
    && similarity.jaccard >= 0.6;

  return strictNameMatch || ingredientBackedMatch || metadataBackedMatch;
}

const COMPARISON_FIELDS =
  "id,site,gtin,product_name,variant,mrp,selling_price,discount_pct,in_stock,product_url,image_url,categories,ingredients";

/**
 * Listings sharing this product's GTIN.
 *
 * A GTIN is the same physical product wherever it is stocked, so this is
 * stronger evidence than any name comparison — and it is the only thing that
 * finds retailers who rename the product wholesale. Nykaa lists barcode
 * 4006000181332 as "NIVEA Luminous Even Glow Brightening Face Serum with
 * Niacinamide, Thiamidol 60X Vitamin C, Aloevera" while Tira calls the same
 * item "Nivea Luminous Even Glow Instant Glow Serum (30 ml)": no name rule
 * will ever pair those, so the card promised "2 retailers" and this panel
 * then found nothing.
 */
async function findByGtin(product) {
  if (!product.gtin) return [];

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select(COMPARISON_FIELDS)
    .eq("gtin", product.gtin)
    .eq("is_active", true)
    .neq("id", product.id)
    .limit(50);

  if (error) {
    console.error("GTIN comparison lookup failed:", error.message);
    return [];
  }
  return data || [];
}

async function findComparableProducts(product) {
  const byGtin = await findByGtin(product);
  if (!product.brand) return dedupeByRetailer([product, ...byGtin]);

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select(COMPARISON_FIELDS)
    .ilike("brand", product.brand)
    .neq("site", product.site)
    .limit(1000);

  if (error) {
    console.error("Failed to find comparable retailer products:", error.message);
    return dedupeByRetailer([product, ...byGtin]);
  }

  const seen = new Set(byGtin.map((row) => row.id));
  const matches = [
    product,
    ...byGtin,
    ...(data || []).filter(
      (candidate) => !seen.has(candidate.id) && isSameProduct(product, candidate),
    ),
  ];
  return dedupeByRetailer(matches);
}

/** Cheapest listing per retailer, cheapest retailer first. */
function dedupeByRetailer(matches) {
  const bestByRetailer = new Map();

  matches.forEach((item) => {
    const existing = bestByRetailer.get(item.site);
    const itemPrice = Number(item.mrp ?? Number.POSITIVE_INFINITY);
    const existingPrice = Number(existing?.mrp ?? Number.POSITIVE_INFINITY);

    if (!existing || itemPrice < existingPrice) {
      bestByRetailer.set(item.site, item);
    }
  });

  return [...bestByRetailer.values()].sort((left, right) => {
      const leftPrice = Number(left.mrp ?? Number.POSITIVE_INFINITY);
      const rightPrice = Number(right.mrp ?? Number.POSITIVE_INFINITY);
      return leftPrice - rightPrice;
    });
}

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Math.ceil(amount))
    : null;
}

function formatAttribute(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value || "");
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return {};

  return {
    title: product.product_name,
    description: product.description || `${product.product_name} by ${product.brand}.`,
  };
}

/**
 * The other sizes this retailer sells of the same product.
 *
 * Queried by brand rather than by parent_product_id alone, because that column
 * is applied inconsistently — see the note in src/lib/variant-sizes.js. The
 * brand narrows it in SQL; isSizeSibling does the precise work in memory.
 */
async function findSizeSiblings(product) {
  if (!product.brand) return [];

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select("id,site,brand,product_name,variant,parent_product_id,selling_price,mrp,in_stock")
    .ilike("brand", product.brand)
    .eq("site", product.site)
    .eq("is_active", true)
    .limit(500);

  if (error) {
    console.error("Size variant lookup failed:", error.message);
    return [];
  }
  return (data || []).filter((candidate) => isSizeSibling(product, candidate));
}

/**
 * One collapsible row of the detail panel.
 *
 * Built on <details> rather than React state because this page is a server
 * component — the browser gets the open/close behaviour, keyboard support and
 * screen-reader semantics without shipping any JavaScript for it.
 *
 * `open` marks the rows worth reading immediately; the long ones (description,
 * the attribute table) start closed so the page is scannable.
 */
function CollapsibleRow({ children, icon: Icon, last, open = false, title, tone }) {
  return (
    <details
      open={open}
      className={`group ${last ? "" : "border-b border-slate-100"}`}
    >
      <summary className="grid cursor-pointer list-none items-center gap-3 p-5 marker:content-[''] hover:bg-slate-50/60 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
        <div className="flex items-center gap-2">
          <Icon
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 ${tone === "warn" ? "text-amber-500" : "text-[#e08a7d]"}`}
          />
          <span className="text-[13px] font-bold tracking-wide text-slate-800">{title}</span>
        </div>
        <div className="flex items-center justify-end lg:justify-between">
          <span className="hidden text-[12px] text-slate-400 lg:inline group-open:lg:hidden">
            Show
          </span>
          <FiChevronDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          />
        </div>
      </summary>
      <div className="grid gap-3 px-5 pb-5 sm:gap-4 sm:px-7 sm:pb-7 lg:grid-cols-[200px_1fr] lg:gap-10">
        <div />
        {children}
      </div>
    </details>
  );
}

export default async function RetailerProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const [comparableProducts, sizeSiblings] = await Promise.all([
    findComparableProducts(product),
    findSizeSiblings(product),
  ]);
  const sizeOptions = buildSizeOptions(product, sizeSiblings);

  const mrp = formatPrice(product.mrp);
  const attributes = Object.entries(product.product_attributes || {})
    .filter(([, value]) => value !== null && value !== "" && formatAttribute(value));
  const availablePrices = comparableProducts
    .map((item) => Number(item.mrp))
    .filter((price) => Number.isFinite(price));
  const lowestPrice = availablePrices.length ? Math.min(...availablePrices) : null;
  const highestPrice = availablePrices.length ? Math.max(...availablePrices) : null;
  // Ingredient cautions come from the same screen the catalogue uses, so a
  // retinoid is flagged here even when the retailer's own copy does not.
  const restrictedNotes = [
    ...new Set(detectRestrictedActives(product).map((rule) => rule.reason)),
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF9F6] text-slate-800">
      <Header />

      <div role="main" className="px-4 py-6 sm:px-6 sm:py-10 lg:px-10 xl:px-12">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/AllProducts"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#e08a7d]"
          >
            <FiArrowLeft aria-hidden="true" />
            Back to products
          </Link>

          {/* ----------------------------------------------------- Hero split */}
          <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12 lg:items-start">
            {/* Image column */}
            <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
              <RetailerProductGallery
                primaryImage={product.image_url}
                imageUrls={product.image_urls}
                productName={product.product_name}
              />

              <div className="mt-3 hidden rounded-3xl border border-slate-100 bg-gradient-to-b from-rose-50/50 to-white p-6 lg:block">
                <div className="flex items-center gap-2">
                  <FiStar aria-hidden="true" className="h-4 w-4 shrink-0 text-[#e08a7d]" />
                  <span className="text-[13px] font-bold tracking-wide text-slate-800">
                    Reasons for products score
                  </span>
                </div>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
                    <FiCheckCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#e08a7d]" />
                    Helps other users with similar skin find products that actually work for them.
                  </li>
                  <li className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
                    <FiCheckCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#e08a7d]" />
                    Sharpens Roopsee&apos;s matching score so recommendations keep improving for everyone.
                  </li>
                  <li className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
                    <FiCheckCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#e08a7d]" />
                    Tells the brand what&apos;s working, straight from real skin, not guesswork.
                  </li>
                </ul>
              </div>
            </div>

            {/* Content column */}
            <div className="min-w-0 bg-white pt-2 sm:rounded-3xl sm:border sm:border-slate-100 sm:p-7 sm:shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider sm:text-[12px]">
                <span className="text-[#e08a7d]">{product.brand || product.site}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{product.site}</span>
                <span
                  className={`rounded-full px-2.5 py-1 ${product.in_stock === false ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}
                >
                  {product.in_stock === false ? "Out of stock" : "In stock"}
                </span>
              </div>

              <h2 className="mt-1 break-words font-lato text-[16px] font-semibold leading-tight text-slate-950 sm:mt-2 sm:text-3xl">
                {product.product_name}
              </h2>


              {/* Size selector — unchanged. */}
              {sizeOptions.length ? (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Size
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sizeOptions.map((option) => (
                      <Link
                        key={option.id}
                        href={`/retailer-products/${option.id}`}
                        aria-current={option.current ? "page" : undefined}
                        className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                          option.current
                            ? "border-[#e08a7d] bg-[#fdf7f5] text-[#b8503f]"
                            : "border-slate-200 text-slate-700 hover:border-[#e08a7d]"
                        }`}
                      >
                        <span className="block text-[13px] font-semibold">{option.size}</span>
                        {option.price ? (
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            ₹{Math.ceil(option.price).toLocaleString("en-IN")}
                          </span>
                        ) : null}
                        {option.inStock ? null : (
                          <span className="mt-0.5 block text-[10px] text-slate-400">Out of stock</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {product.rating ? (
                <p className="mt-4 text-[13px] font-semibold text-amber-600">
                  ★ {Number(product.rating).toFixed(1)}
                  {product.rating_count
                    ? ` (${Number(product.rating_count).toLocaleString("en-IN")} ratings)`
                    : ""}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1 sm:mt-5">
                <span className="text-[15px] font-extrabold leading-none text-slate-900 sm:text-[1.9rem]">
                  {mrp || "Price unavailable"}
                </span>
              </div>
              <p className="mt-1 hidden text-[12px] text-slate-400 sm:block">Inclusive of all taxes</p>

              <TypicalPriceRange
                currentPrice={product.mrp}
                prices={availablePrices}
              />

              {/* ------------------------------------------ Retailer comparison */}
              <div id="buy-options" className="mt-5">
                {comparableProducts.length > 1 ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Compare prices
                      </p>
                      {lowestPrice !== null && highestPrice !== null && highestPrice > lowestPrice ? (
                        <p className="text-[11px] text-slate-400">
                          ₹{Math.ceil(lowestPrice).toLocaleString("en-IN")} – ₹
                          {Math.ceil(highestPrice).toLocaleString("en-IN")}
                        </p>
                      ) : null}
                    </div>

                    <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                      {comparableProducts.map((item) => {
                        const price = Number(item.mrp);
                        const isLowest = lowestPrice !== null && price === lowestPrice;
                        return (
                          <li
                            key={item.id}
                            className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${isLowest ? "bg-rose-50/60" : "bg-white"}`}
                          >
                            <div className="min-w-0 flex-1">
                              <RetailerLogo site={item.site} height={46} />
                              <p className="mt-1 truncate text-[11px] text-slate-400">
                                {item.id === product.id ? "You are viewing this" : item.variant || canonicalSize(item.product_name) || "Standard size"}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-[14px] font-bold text-slate-900">
                                {formatPrice(item.mrp) || "—"}
                              </p>
                              {isLowest ? (
                                <p className="text-[10px] font-bold uppercase text-emerald-700">Lowest</p>
                              ) : null}
                            </div>

                            {item.product_url ? (
                              <a
                                href={item.product_url}
                                target="_blank"
                                rel="noopener noreferrer nofollow sponsored"
                                className="shrink-0 rounded-full border border-[#e08a7d] px-3.5 py-1.5 text-[12px] font-semibold text-[#d77465] transition-colors hover:bg-[#e08a7d] hover:text-white"
                              >
                                Buy now
                              </a>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Compared only when the barcode, or the brand, product name and size, match.
                    </p>
                  </>
                ) : product.product_url ? (
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f3a99a] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#e08a7d]"
                  >
                    View on {siteName(product.site)}
                    <FiExternalLink aria-hidden="true" />
                  </a>
                ) : null}
              </div>

              <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-400 sm:text-[12px]">
                <FiAlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                It is always advised that products shall be patch tested before use.
              </p>
            </div>
          </div>

          {/* -------------------------------------------------- Product Playground */}
          <RetailerProductPlayground
            productId={product.id}
            category={canonicalCategory(product)}
          />

          {/* ------------------------------------------------ You may also like */}
          <RetailerSimilarProducts
            category={canonicalCategory(product)}
            excludeUid={String(product.id)}
          />

          {/* ------------------------------------------------------ Detail rows */}
          <div className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm sm:mt-8 lg:mt-10">
            {product.description ? (
              <CollapsibleRow icon={FiFileText} title="DESCRIPTION">
                <p className="max-w-2xl break-words text-[14px] leading-relaxed text-slate-600 sm:text-[14.5px]">
                  {product.description}
                </p>
              </CollapsibleRow>
            ) : null}

            <CollapsibleRow icon={FiDroplet} title="KEY INGREDIENTS" open>
              <div className="max-w-2xl">
                {product.key_ingredients?.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {product.key_ingredients.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#d77465]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}

                {product.ingredients ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                      Full ingredient list (INCI)
                    </div>
                    <p className="mt-2 break-words text-[12.5px] leading-relaxed text-slate-500">
                      {product.ingredients}
                    </p>
                  </div>
                ) : (
                  <span className="text-[14px] text-slate-400">Not listed</span>
                )}
              </div>
            </CollapsibleRow>

            <CollapsibleRow icon={FiInfo} title="HOW TO USE" open>
              <p className="max-w-2xl break-words text-[14px] leading-relaxed text-slate-600 sm:text-[14.5px]">
                {product.how_to_use || "Follow the directions printed on the product packaging."}
              </p>
            </CollapsibleRow>

            {restrictedNotes.length ? (
              <CollapsibleRow icon={FiAlertTriangle} title="CAUTIONS" tone="warn" open>
                <div className="max-w-2xl rounded-xl border-l-4 border-amber-400 bg-amber-50 px-5 py-4">
                  <ul className="space-y-2">
                    {restrictedNotes.map((note) => (
                      <li key={note} className="break-words text-[14px] leading-relaxed text-amber-900">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              </CollapsibleRow>
            ) : null}

            {attributes.length ? (
              <CollapsibleRow icon={FiTag} title="PRODUCT INFORMATION">
                <dl className="max-w-2xl divide-y divide-slate-100">
                  {attributes.map(([label, value]) => (
                    <div key={label} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-5">
                      <dt className="text-[13px] font-semibold text-slate-500">{label}</dt>
                      <dd className="text-[13px] text-slate-700">{formatAttribute(value)}</dd>
                    </div>
                  ))}
                </dl>
              </CollapsibleRow>
            ) : null}

            <CollapsibleRow icon={FiShield} title="SAFETY NOTE" last>
              <p className="max-w-2xl text-[13px] leading-relaxed text-slate-400 sm:text-[13.5px]">
                Product matching supports discovery and does not diagnose or treat a skin condition.
                Patch test when appropriate, follow the manufacturer&apos;s instructions, and consult a
                qualified healthcare professional for persistent, painful or worsening symptoms.
              </p>
            </CollapsibleRow>
          </div>
        </div>
      </div>
    </div>
  );
}
