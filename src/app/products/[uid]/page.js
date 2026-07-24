/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import { findProduct, loadProducts } from "@/lib/data";
import { SKIN_GUIDES } from "@/lib/seo-pages";
import { absoluteUrl, productPath } from "@/lib/site";

export const dynamicParams = false;

function descriptionFor(product) {
  const description = product.product_description
    || `${product.product_name} by ${product.brand_name}, listed in the Roopsee skincare catalog.`;
  return description.length > 158 ? `${description.slice(0, 155).trim()}...` : description;
}

function priceAmount(product) {
  const value = product.sp || product.mrp;
  const number = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function numericValue(raw) {
  const number = Number(String(raw || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function generateStaticParams() {
  return loadProducts().map((product) => ({ uid: product.product_uid }));
}

export async function generateMetadata({ params }) {
  const { uid } = await params;
  const product = findProduct(uid);
  if (!product) return {};
  const canonical = productPath(product.product_uid);
  const description = descriptionFor(product);
  return {
    title: product.product_name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: product.product_name,
      description,
      images: product.image ? [{ url: product.image, alt: product.product_name }] : ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: product.product_name,
      description,
      images: product.image ? [product.image] : ["/opengraph-image"],
    },
  };
}

// Presentational helpers -------------------------------------------------------

function SpecRow({ label, value }) {
  return (
    <li className="flex items-baseline gap-3 py-2">
      <span className="shrink-0 text-[10.5px] uppercase tracking-[0.14em] text-[#1E2A22]/45">
        {label}
      </span>
      <span aria-hidden="true" className="mb-[3px] flex-1 border-b border-dotted border-[#1E2A22]/25" />
      <span className="shrink-0 font-mono text-[13px] text-[#1E2A22]">{value}</span>
    </li>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5B7F62]">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#5B7F62]" />
      {children}
    </div>
  );
}

export default async function ProductPage({ params }) {
  const { uid } = await params;
  const product = findProduct(uid);
  if (!product) notFound();

  const price = priceAmount(product);
  const mrpValue = numericValue(product.mrp);
  const spValue = numericValue(product.sp);
  const hasDiscount = mrpValue && spValue && mrpValue > spValue;
  const percentOff = hasDiscount ? Math.round(((mrpValue - spValue) / mrpValue) * 100) : null;

  const canonical = absoluteUrl(productPath(product.product_uid));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonical}#product`,
    url: canonical,
    name: product.product_name,
    description: product.product_description || descriptionFor(product),
    sku: product.product_uid,
    category: product.category,
    image: product.image ? [product.image] : undefined,
    brand: product.brand_name
      ? { "@type": "Brand", name: product.brand_name }
      : undefined,
    offers: price
      ? {
        "@type": "Offer",
        url: canonical,
        priceCurrency: "INR",
        price,
      }
      : undefined,
    additionalProperty: [
      product.product_type && {
        "@type": "PropertyValue",
        name: "Product type",
        value: product.product_type,
      },
      product.single_hero_ingredient && {
        "@type": "PropertyValue",
        name: "Hero ingredient",
        value: product.single_hero_ingredient,
      },
      product.sku_size && {
        "@type": "PropertyValue",
        name: "Size",
        value: product.sku_size,
      },
    ].filter(Boolean),
  };

  const secondaryIngredients = (product.secondary_hero_ingredients || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div
      className="min-h-screen bg-[#F3F5EF] pb-28 text-[#1E2A22] [font-family:var(--font-body,'Inter',ui-sans-serif,system-ui,sans-serif)] lg:pb-0"
      style={{
        backgroundImage:
          "radial-gradient(rgba(30,42,34,0.05) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />

      {/* ---------------------------------------------------------------- Header */}
      <header className="mx-auto max-w-[1400px] px-5 pt-6 sm:px-8 sm:pt-9 lg:px-12">
        <Link
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1E2A22]/55 transition hover:text-[#5B7F62] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5B7F62]"
          href="/"
        >
          <span aria-hidden="true">&larr;</span> Back to matches
        </Link>
      </header>

      {/* ------------------------------------------------------------- Hero split */}
      <main className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <div className="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
          {/* Image column */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="aspect-[4/5] w-full overflow-hidden rounded-[28px] border border-[#1E2A22]/8 bg-[#E9EDE4] shadow-[0_1px_2px_rgba(30,42,34,0.06)]">
              {product.image ? (
                <img
                  alt={product.product_name}
                  className="h-full w-full object-cover"
                  src={product.image}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-8xl font-normal text-[#5B7F62]/30 [font-family:var(--font-display,'Fraunces',ui-serif,Georgia,serif)]">
                  R
                </div>
              )}
            </div>
          </div>

          {/* Content column */}
          <div>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-[#5B7F62]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5B7F62]">
                {product.brand_name || "Roopsee catalog product"}
              </span>
            </div>

            <h1 className="mt-4 text-[clamp(2.1rem,4vw,3.1rem)] font-normal leading-[1.06] tracking-tight [font-family:var(--font-display,'Fraunces',ui-serif,Georgia,serif)]">
              {product.product_name}
            </h1>

            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#1E2A22]/65">
              {product.product_description || descriptionFor(product)}
            </p>

            {/* Price */}
            <div className="mt-7 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-[2rem] font-normal leading-none [font-family:var(--font-display,'Fraunces',ui-serif,Georgia,serif)]">
                {product.sp || product.mrp ? `Rs. ${product.sp || product.mrp}` : "Price not listed"}
              </span>
              {hasDiscount ? (
                <>
                  <span className="text-[15px] text-[#1E2A22]/40 line-through">
                    Rs. {product.mrp}
                  </span>
                  <span className="rounded-full bg-[#E4EBE0] px-2.5 py-0.5 text-[12px] font-medium text-[#3F5B44]">
                    {percentOff}% off
                  </span>
                </>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] text-[#1E2A22]/45">Inclusive of all taxes</p>

            {/* CTA */}
            <Link
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#1E2A22] px-7 py-3.5 text-[14px] font-medium text-white transition hover:bg-[#5B7F62] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5B7F62] sm:w-auto"
              href="/"
            >
              Find my personalised matches
            </Link>

            {/* Signature: catalog spec "hang tag" */}
            <div className="relative mt-9 rounded-2xl border border-[#1E2A22]/10 bg-[#FBFAF6] pb-5 pt-8">
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-3 h-3 w-3 -translate-x-1/2 rounded-full border border-[#1E2A22]/15 bg-[#F3F5EF]"
              />
              <span
                aria-hidden="true"
                className="absolute inset-x-6 top-8 h-px"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, rgba(30,42,34,0.28) 0 5px, transparent 5px 9px)",
                }}
              />
              <div className="px-6">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#1E2A22]/40">
                  Catalog information
                </div>
                <ul className="mt-1 divide-y divide-[#1E2A22]/8">
                  <SpecRow label="Category" value={product.category || "Not listed"} />
                  <SpecRow label="Type" value={product.product_type || "Not listed"} />
                  <SpecRow label="Size" value={product.sku_size || "Not listed"} />
                  <SpecRow label="Use" value={product.when_to_use || "As directed"} />
                  <SpecRow label="SKU" value={product.product_uid} />
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------- Detail rows */}
        <div className="mt-16 border-t border-[#1E2A22]/10 lg:mt-24">
          {/* Key ingredients */}
          <div className="grid gap-4 border-b border-[#1E2A22]/10 py-10 lg:grid-cols-[220px_1fr] lg:gap-12">
            <SectionLabel>Key ingredients</SectionLabel>
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                {product.single_hero_ingredient ? (
                  <span className="rounded-full bg-[#E4EBE0] px-3.5 py-1.5 text-[13px] font-medium text-[#3F5B44]">
                    {product.single_hero_ingredient}
                  </span>
                ) : null}
                {secondaryIngredients.map((item) => (
                  <span
                    className="rounded-full border border-[#1E2A22]/12 px-3.5 py-1.5 text-[13px] text-[#1E2A22]/70"
                    key={item}
                  >
                    {item}
                  </span>
                ))}
                {!product.single_hero_ingredient && secondaryIngredients.length === 0 ? (
                  <span className="text-[14px] text-[#1E2A22]/50">Not listed</span>
                ) : null}
              </div>

              {product.ingredients ? (
                <div className="mt-5 rounded-xl bg-[#EEF1EA] p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1E2A22]/40">
                    Full ingredient list (INCI)
                  </div>
                  <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-[#1E2A22]/70">
                    {product.ingredients}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* How to use */}
          <div className="grid gap-4 border-b border-[#1E2A22]/10 py-10 lg:grid-cols-[220px_1fr] lg:gap-12">
            <SectionLabel>How to use</SectionLabel>
            <p className="max-w-2xl text-[15px] leading-relaxed text-[#1E2A22]/75">
              {product.usage_instructions || "Follow the directions printed on the product packaging."}
            </p>
          </div>

          {/* Ingredient cautions */}
          {product.ingredient_cautions ? (
            <div className="grid gap-4 border-b border-[#1E2A22]/10 py-10 lg:grid-cols-[220px_1fr] lg:gap-12">
              <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A611F]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#B8823B]" />
                Cautions
              </div>
              <div className="max-w-2xl rounded-xl border-l-4 border-[#B8823B] bg-[#FBF4E6] px-5 py-4">
                <p className="text-[14px] leading-relaxed text-[#6B4E1B]">
                  {product.ingredient_cautions}
                </p>
              </div>
            </div>
          ) : null}

          {/* Safety note */}
          <div className="grid gap-4 border-b border-[#1E2A22]/10 py-10 lg:grid-cols-[220px_1fr] lg:gap-12">
            <SectionLabel>Safety note</SectionLabel>
            <p className="max-w-2xl text-[13.5px] leading-relaxed text-[#1E2A22]/55">
              Product matching supports discovery and does not diagnose or treat a skin condition.
              Patch test when appropriate, follow the manufacturer&apos;s instructions, and consult a
              qualified healthcare professional for persistent, painful or worsening symptoms.
            </p>
          </div>

          {/* Explore skincare guides */}
          <div className="grid gap-4 py-10 lg:grid-cols-[220px_1fr] lg:gap-12">
            <SectionLabel>Explore guides</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SKIN_GUIDES.map((guide) => (
                <Link
                  className="rounded-full border border-[#1E2A22]/12 bg-white px-4 py-2 text-[13px] font-medium text-[#1E2A22]/75 transition hover:border-[#5B7F62] hover:text-[#5B7F62] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5B7F62]"
                  href={`/?guide=${guide.slug}#matcher`}
                  key={guide.slug}
                >
                  {guide.eyebrow}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* --------------------------------------------------- Mobile sticky bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-[#1E2A22]/10 bg-[#FBFAF6]/95 px-4 pt-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0 shrink">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#1E2A22]/45">Price</div>
          <div className="truncate text-[17px] font-medium [font-family:var(--font-display,'Fraunces',ui-serif,Georgia,serif)]">
            {product.sp || product.mrp ? `Rs. ${product.sp || product.mrp}` : "\u2014"}
          </div>
        </div>
        <Link
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#1E2A22] px-5 py-3 text-[13px] font-medium text-white transition hover:bg-[#5B7F62] sm:px-6 sm:text-[13.5px]"
          href="/"
        >
          Find matches
        </Link>
      </div>
    </div>
  );
}