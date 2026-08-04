import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowLeft, FiChevronDown, FiExternalLink } from "react-icons/fi";
import Header from "@/components/header";
import RetailerProductGallery from "@/components/retailer-product-gallery";
import { supabaseAdmin } from "@/lib/supabase/server";

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

async function findComparableProducts(product) {
  if (!product.brand) return [product];

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select("id,site,product_name,variant,mrp,selling_price,discount_pct,in_stock,product_url,image_url,categories,ingredients")
    .ilike("brand", product.brand)
    .neq("site", product.site)
    .limit(1000);

  if (error) {
    console.error("Failed to find comparable retailer products:", error.message);
    return [product];
  }

  const matches = [product, ...(data || []).filter((candidate) => isSameProduct(product, candidate))];
  const bestByRetailer = new Map();

  matches.forEach((item) => {
    const existing = bestByRetailer.get(item.site);
    const itemPrice = Number(item.selling_price ?? item.mrp ?? Number.POSITIVE_INFINITY);
    const existingPrice = Number(existing?.selling_price ?? existing?.mrp ?? Number.POSITIVE_INFINITY);

    if (!existing || itemPrice < existingPrice) {
      bestByRetailer.set(item.site, item);
    }
  });

  return [...bestByRetailer.values()].sort((left, right) => {
      const leftPrice = Number(left.selling_price ?? left.mrp ?? Number.POSITIVE_INFINITY);
      const rightPrice = Number(right.selling_price ?? right.mrp ?? Number.POSITIVE_INFINITY);
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
    }).format(amount)
    : null;
}

function formatAttribute(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value || "");
}

function CollapsibleDetailSection({ children, title }) {
  return (
    <details className="group border-t border-slate-100 py-6 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e08a7d] [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-bold uppercase tracking-[0.12em] text-slate-800">
          {title}
        </span>
        <FiChevronDown
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
        {children}
      </div>
    </details>
  );
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

export default async function RetailerProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const comparableProducts = await findComparableProducts(product);

  const sellingPrice = formatPrice(product.selling_price);
  const mrp = formatPrice(product.mrp);
  const hasDiscount = product.mrp !== null
    && product.selling_price !== null
    && Number(product.mrp) > Number(product.selling_price);
  const attributes = Object.entries(product.product_attributes || {})
    .filter(([, value]) => value !== null && value !== "" && formatAttribute(value));
  const availablePrices = comparableProducts
    .map((item) => Number(item.selling_price ?? item.mrp))
    .filter((price) => Number.isFinite(price));
  const lowestPrice = availablePrices.length ? Math.min(...availablePrices) : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF9F6] text-slate-800">
      <Header />

      <div
        role="main"
        className="px-4 py-6 sm:px-6 sm:py-10 lg:px-10 xl:px-12"
      >
        <div className="mx-auto max-w-6xl">
        <Link
          href="/AllProducts"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#e08a7d]"
        >
          <FiArrowLeft aria-hidden="true" />
          Back to products
        </Link>

        <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
          <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <RetailerProductGallery
              primaryImage={product.image_url}
              imageUrls={product.image_urls}
              productName={product.product_name}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <span className="text-[#e08a7d]">{product.brand || product.site}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                {product.site}
              </span>
              <span className={`rounded-full px-2.5 py-1 ${product.in_stock === false ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                {product.in_stock === false ? "Out of stock" : "In stock"}
              </span>
            </div>

            <h1 className="mt-3 break-words font-cormorant text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {product.product_name}
            </h1>
            {product.variant ? (
              <p className="mt-2 text-sm text-slate-500">{product.variant}</p>
            ) : null}

            {product.rating ? (
              <p className="mt-4 text-sm font-semibold text-amber-600">
                ★ {Number(product.rating).toFixed(1)}
                {product.rating_count ? ` (${Number(product.rating_count).toLocaleString("en-IN")} ratings)` : ""}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <span className="text-3xl font-bold text-slate-950">
                {sellingPrice || mrp || "Price unavailable"}
              </span>
              {hasDiscount ? (
                <span className="pb-1 text-base text-slate-400 line-through">{mrp}</span>
              ) : null}
              {product.discount_pct ? (
                <span className="mb-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-[#d77465]">
                  {Math.round(Number(product.discount_pct))}% off
                </span>
              ) : null}
            </div>

            {product.product_url ? (
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#f3a99a] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#e08a7d]"
              >
                View on {product.site}
                <FiExternalLink aria-hidden="true" />
              </a>
            ) : null}

            <div className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <CollapsibleDetailSection title="Description">
                {product.description || "No product description is available."}
              </CollapsibleDetailSection>

              {product.key_features?.length ? (
                <CollapsibleDetailSection title="Key features">
                  <ul className="list-disc space-y-1 pl-5">
                    {product.key_features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                </CollapsibleDetailSection>
              ) : null}

              {product.ingredients ? (
                <CollapsibleDetailSection title="Ingredients">
                  {product.ingredients}
                </CollapsibleDetailSection>
              ) : null}
              {product.how_to_use ? (
                <CollapsibleDetailSection title="How to use">
                  {product.how_to_use}
                </CollapsibleDetailSection>
              ) : null}

              {product.categories?.length ? (
                <CollapsibleDetailSection title="Categories">
                  <div className="flex flex-wrap gap-2">
                    {product.categories.map((category) => (
                      <span key={category} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {category}
                      </span>
                    ))}
                  </div>
                </CollapsibleDetailSection>
              ) : null}

              {attributes.length ? (
                <CollapsibleDetailSection title="Product information">
                  <dl className="divide-y divide-slate-100">
                    {attributes.map(([label, value]) => (
                      <div key={label} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-5">
                        <dt className="font-semibold text-slate-500">{label}</dt>
                        <dd className="text-slate-700">{formatAttribute(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </CollapsibleDetailSection>
              ) : null}
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:mt-10 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e08a7d]">
                Retailer comparison
              </p>
              <h2 className="mt-1 font-cormorant text-2xl font-semibold text-slate-950 sm:text-3xl">
                Compare prices
              </h2>
            </div>
            <p className="max-w-md text-xs leading-5 text-slate-400">
              Compared only when the brand, product name, and size match.
            </p>
          </div>

          {comparableProducts.length > 1 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {comparableProducts.map((item) => {
                const price = Number(item.selling_price ?? item.mrp);
                const itemPrice = formatPrice(item.selling_price ?? item.mrp);
                const itemMrp = formatPrice(item.mrp);
                const itemHasDiscount = item.mrp !== null
                  && item.selling_price !== null
                  && Number(item.mrp) > Number(item.selling_price);
                const isLowest = lowestPrice !== null && price === lowestPrice;

                return (
                  <article
                    key={item.id}
                    className={`relative rounded-2xl border p-4 ${isLowest ? "border-emerald-300 bg-emerald-50/40" : "border-slate-150 bg-white"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                        {item.site}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.id === product.id ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                            Current
                          </span>
                        ) : null}
                        {isLowest ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">
                            Lowest price
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      {item.variant || canonicalSize(item.product_name) || "Standard size"}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-700">
                      {item.product_name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <span className="text-2xl font-bold text-slate-950">
                        {itemPrice || "Price unavailable"}
                      </span>
                      {itemHasDiscount ? (
                        <span className="pb-0.5 text-sm text-slate-400 line-through">{itemMrp}</span>
                      ) : null}
                    </div>
                    <p className={`mt-2 text-xs font-semibold ${item.in_stock === false ? "text-red-600" : "text-emerald-700"}`}>
                      {item.in_stock === false ? "Out of stock" : "In stock"}
                    </p>

                    {item.product_url ? (
                      <a
                        href={item.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#d77465] transition hover:text-[#b95f52] hover:underline"
                      >
                        View deal
                        <FiExternalLink aria-hidden="true" />
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
              No matching listing for this exact product and size was found on another retailer.
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
