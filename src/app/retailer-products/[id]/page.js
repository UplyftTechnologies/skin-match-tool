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
import RetailerProductScoreBadge from "@/components/retailer-product-score-badge";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildSizeOptions, isSizeSibling } from "@/lib/variant-sizes";
import { canonicalSize, findComparableProducts } from "@/lib/retailer-product-match";
import { canonicalCategory } from "@/lib/retailer-catalog";
import { detectRestrictedActives } from "@/lib/scoring/ingredient-safety";
import RetailerSimilarProducts from "@/components/retailer-similar-products";
import RetailerProductPlayground from "@/components/retailer-product-playground";
import TypicalPriceRange from "@/components/typical-price-range";
import RetailerLogo from "@/components/retailer-logo";
import { siteName } from "@/lib/site-name";
import RequireQuizGate from "@/components/require-quiz-gate";

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

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
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

// Retailers scrape their own copy independently, so the same physical product
// can have a description on Tira but not on Nykaa, or vice versa. The page the
// shopper lands on is whichever retailer's `id` is in the URL — showing only
// that one row's fields meant half the products looked empty even though a
// sibling listing of the identical item had the copy. Scanning every
// comparable listing (this one first) finds real content far more often than
// trusting whichever retailer happens to be primary.
function pickFirst(rows, field) {
  for (const row of rows) {
    const value = row?.[field];
    if (Array.isArray(value) ? value.length : value) return value;
  }
  return null;
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
  // Nykaa's copy is the best-scraped and most trusted, so it wins whenever a
  // sibling listing on Nykaa exists — the viewed retailer's own copy (and
  // then every other sibling) only fills in whatever Nykaa is missing.
  const allSources = [product, ...comparableProducts];
  const nykaaSource = allSources.find((row) => row?.site === "nykaa");
  const detailSources = nykaaSource
    ? [nykaaSource, ...allSources.filter((row) => row !== nykaaSource)]
    : allSources;
  const description = pickFirst(detailSources, "description");
  const keyIngredients = pickFirst(detailSources, "key_ingredients") || [];
  const ingredientsList = pickFirst(detailSources, "ingredients");
  const howToUse = pickFirst(detailSources, "how_to_use");
  const attributes = Object.entries(pickFirst(detailSources, "product_attributes") || {})
    .filter(([, value]) => value !== null && value !== "" && formatAttribute(value));
  const availablePrices = comparableProducts
    .map((item) => Number(item.mrp))
    .filter((price) => Number.isFinite(price) && price > 0);
  const lowestPrice = availablePrices.length ? Math.min(...availablePrices) : null;
  const highestPrice = availablePrices.length ? Math.max(...availablePrices) : null;
  // Ingredient cautions come from the same screen the catalogue uses, so a
  // retinoid is flagged here even when the retailer's own copy does not.
  const restrictedRules = detectRestrictedActives(product);
  const restrictedNotes = [...new Set(restrictedRules.map((rule) => rule.reason))];
  const restrictedIds = [...new Set(restrictedRules.map((rule) => rule.id))];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#FAF9F6] text-slate-800">
      <Header />

      <RequireQuizGate
        title="Take the skin quiz to see this product"
        description="Answer a few quick questions so this product is scored for your skin."
        navigateToHomeQuiz
      >
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
              >
                <RetailerProductScoreBadge
                  productUrl={product.product_url}
                  restricted={restrictedIds}
                  fallbackUrls={comparableProducts
                    .map((item) => item.product_url)
                    .filter((url) => url && url !== product.product_url)}
                />
              </RetailerProductGallery>

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
                <span className="text-[#e08a7d] text-lato font-bold">{product.brand || product.site}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 text-lato font-bold">
                  {product.site}</span>
                <span
                  className={`rounded-full px-2.5 py-1 ${product.in_stock === false ? "bg-red-50 text-red-600 text-lato font-bold" : "bg-emerald-50 text-emerald-700 text-lato font-bold"}`}
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
                  {mrp || "Out of stock"}
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
                                {formatPrice(item.mrp) || "Out of stock"}
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
            category={canonicalCategory(product, comparableProducts)}
          />

          {/* ------------------------------------------------ You may also like */}
          <RetailerSimilarProducts
            category={canonicalCategory(product, comparableProducts)}
            excludeUid={String(product.id)}
          />

          {/* ------------------------------------------------------ Detail rows */}
          <div className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm sm:mt-8 lg:mt-10">
            {description ? (
              <CollapsibleRow icon={FiFileText} title="DESCRIPTION">
                <p className="max-w-2xl break-words text-[14px] leading-relaxed text-slate-600 sm:text-[14.5px]">
                  {description}
                </p>
              </CollapsibleRow>
            ) : null}

            <CollapsibleRow icon={FiDroplet} title="KEY INGREDIENTS" open>
              <div className="max-w-2xl">
                {keyIngredients.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {keyIngredients.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#d77465]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}

                {ingredientsList ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                      Full ingredient list (INCI)
                    </div>
                    <p className="mt-2 break-words text-[12.5px] leading-relaxed text-slate-500">
                      {ingredientsList}
                    </p>
                  </div>
                ) : (
                  <span className="text-[14px] text-slate-400">Not listed</span>
                )}
              </div>
            </CollapsibleRow>

            <CollapsibleRow icon={FiInfo} title="HOW TO USE" open>
              <p className="max-w-2xl break-words text-[14px] leading-relaxed text-slate-600 sm:text-[14.5px]">
                {howToUse || "Follow the directions printed on the product packaging."}
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
      </RequireQuizGate>
    </div>
  );
}
