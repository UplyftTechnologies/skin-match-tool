/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCompass,
  FiDroplet,
  FiInfo,
  FiShield,
  FiTag,
} from "react-icons/fi";
import { findProduct, loadProducts } from "@/lib/data";
import { SKIN_GUIDES } from "@/lib/seo-pages";
import { absoluteUrl, productPath } from "@/lib/site";
import SaveProductButton from "@/components/save-product-button";
import Header from "@/components/header";
import ProductScoreBadge from "@/components/product-score-badge";

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
    <li className="flex items-baseline gap-2 py-2 sm:gap-3">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-[10.5px]">
        {label}
      </span>
      <span aria-hidden="true" className="mb-[3px] flex-1 border-b border-dotted border-slate-200" />
      <span className="shrink-0 text-[12.5px] font-semibold text-slate-800 sm:text-[13px]">{value}</span>
    </li>
  );
}

function SectionHeading({ index, icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2">
      {index ? (
        <span className="text-[13px] font-extrabold text-sky-500">{index}.</span>
      ) : (
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-500" />
      )}
      <span className="text-[13px] font-bold tracking-wide text-slate-800">{title}</span>
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

  // Shape the product to match what ProductCard / WishlistContext expect
  const wishlistProduct = {
    product_uid: product.product_uid,
    product_name: product.product_name,
    brand_name: product.brand_name,
    category: product.category,
    product_type: product.product_type,
    image: product.image,
    selling_price: product.sp,
    mrp: product.mrp,
    size: product.sku_size,
    when_to_use: product.when_to_use,
    score: product.score, // may be undefined here — ProductCard handles that gracefully
  };

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
    <div className="rps-pdp min-h-screen bg-slate-50 pb-28 text-slate-800 lg:pb-0">
      <Header
       
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />

      {/* ---------------------------------------------------------------- Header */}
      <div className="block w-full mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-8 lg:px-6">
        <Link
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-sky-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
          href="/"
        >
          <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to matches
        </Link>
      </div>

      {/* ------------------------------------------------------------- Hero split */}
      <div className="block w-full mx-auto max-w-6xl px-4 sm:px-6 lg:px-6">
        <div className="mt-5 grid gap-6 sm:mt-6 lg:mt-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:gap-10 lg:items-start">
          {/* Image column */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.12)]">
              {product.image ? (
                <img
                  alt={product.product_name}
                  className="h-full w-full object-cover"
                  src={product.image}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-6xl font-extrabold text-sky-200 sm:text-8xl">
                  R
                </div>
              )}
              <ProductScoreBadge />
            </div>
          </div>

          {/* Content column */}
          <div className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.12)] sm:p-6 lg:p-7">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-500 sm:text-[12px]">
              {product.brand_name || "Roopsee catalog product"}
            </span>

            <h1 className="mt-2 text-[clamp(1.5rem,5vw,2.4rem)] font-extrabold leading-[1.15] tracking-tight text-slate-900">
              {product.product_name}
            </h1>

            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-slate-500 sm:text-[14.5px]">
              {product.product_description || descriptionFor(product)}
            </p>

            {/* Price */}
            <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-[1.7rem] font-extrabold leading-none text-slate-900 sm:text-[1.9rem]">
                {product.sp || product.mrp ? `Rs. ${product.sp || product.mrp}` : "Price not listed"}
              </span>
              {hasDiscount ? (
                <>
                  <span className="text-[14px] text-slate-400 line-through">
                    Rs. {product.mrp}
                  </span>
                  <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[12px] font-bold text-sky-700">
                    {percentOff}% off
                  </span>
                </>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] text-slate-400">Inclusive of all taxes</p>

            {/* CTA — desktop / tablet button, hidden below lg since the mobile sticky bar covers it there */}
            <div className="mt-5 hidden lg:block">
              <SaveProductButton
                product={wishlistProduct}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r
                 from-sky-400 to-cyan-500 px-7 py-3.5 text-[13.5px] font-semibold tracking-wide text-white
                 shadow-lg shadow-sky-300/40 transition-all hover:-translate-y-0.5 hover:shadow-xl
                 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
              />
            </div>

            {/* Signature: catalog spec "label" card */}
            <div className="mt-6 rounded-[14px] border border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 sm:text-[10.5px]">
                <FiTag aria-hidden="true" className="h-3.5 w-3.5 text-sky-500" />
                Catalog information
              </div>
              <ul className="mt-1 divide-y divide-slate-200/70">
                <SpecRow label="Category" value={product.category || "Not listed"} />
                <SpecRow label="Type" value={product.product_type || "Not listed"} />
                <SpecRow label="Size" value={product.sku_size || "Not listed"} />
                <SpecRow label="Use" value={product.when_to_use || "As directed"} />
                <SpecRow label="SKU" value={product.product_uid} />
              </ul>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------- Detail rows */}
        <div className="mt-6 rounded-[18px] border border-slate-100 bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.12)] sm:mt-8 lg:mt-10">
          {/* Key ingredients */}
          <div className="grid gap-3 border-b border-slate-100 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
            <SectionHeading icon={FiDroplet} title="KEY INGREDIENTS" />
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                {product.single_hero_ingredient ? (
                  <span className="rounded-full border border-sky-300 bg-sky-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-sky-700">
                    {product.single_hero_ingredient}
                  </span>
                ) : null}
                {secondaryIngredients.map((item) => (
                  <span
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-600"
                    key={item}
                  >
                    {item}
                  </span>
                ))}
                {!product.single_hero_ingredient && secondaryIngredients.length === 0 ? (
                  <span className="text-[14px] text-slate-400">Not listed</span>
                ) : null}
              </div>

              {product.ingredients ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                    Full ingredient list (INCI)
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
                    {product.ingredients}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* How to use */}
          <div className="grid gap-3 border-b border-slate-100 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
            <SectionHeading icon={FiInfo} title="HOW TO USE" />
            <p className="max-w-2xl text-[14px] leading-relaxed text-slate-600 sm:text-[14.5px]">
              {product.usage_instructions || "Follow the directions printed on the product packaging."}
            </p>
          </div>

          {/* Ingredient cautions */}
          {product.ingredient_cautions ? (
            <div className="grid gap-3 border-b border-slate-100 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
              <div className="flex items-center gap-2">
                <FiAlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="text-[13px] font-bold tracking-wide text-slate-800">CAUTIONS</span>
              </div>
              <div className="max-w-2xl rounded-xl border-l-4 border-amber-400 bg-amber-50 px-5 py-4">
                <p className="text-[14px] leading-relaxed text-amber-900">
                  {product.ingredient_cautions}
                </p>
              </div>
            </div>
          ) : null}

          {/* Safety note */}
          <div className="grid gap-3 border-b border-slate-100 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
            <SectionHeading icon={FiShield} title="SAFETY NOTE" />
            <p className="max-w-2xl text-[13px] leading-relaxed text-slate-400 sm:text-[13.5px]">
              Product matching supports discovery and does not diagnose or treat a skin condition.
              Patch test when appropriate, follow the manufacturer&apos;s instructions, and consult a
              qualified healthcare professional for persistent, painful or worsening symptoms.
            </p>
          </div>

          {/* Explore skincare guides */}
          <div className="grid gap-3 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
            <SectionHeading icon={FiCompass} title="EXPLORE GUIDES" />
            <div className="flex flex-wrap gap-2">
              {SKIN_GUIDES.map((guide) => (
                <Link
                  className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1.5 text-[12px] font-bold text-sky-700 transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
                  href={`/?guide=${guide.slug}#matcher`}
                  key={guide.slug}
                >
                  {guide.eyebrow}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- Mobile sticky bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-4 pt-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0 shrink">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Price</div>
          <div className="truncate text-[17px] font-extrabold text-slate-900">
            {product.sp || product.mrp ? `Rs. ${product.sp || product.mrp}` : "\u2014"}
          </div>
        </div>
        <SaveProductButton
          product={wishlistProduct}
          mobile
          className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full
           bg-gradient-to-r from-sky-400 to-cyan-500 px-5 py-3 text-[13px] font-extrabold tracking-wide
           text-white shadow-md shadow-sky-300/40 transition hover:-translate-y-0.5 sm:px-6 sm:text-[13.5px]"
        />
      </div>
    </div>
  );
}
