/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiCompass,
  FiDroplet,
  FiInfo,
  FiShield,
  FiStar,
  FiTag,
} from "react-icons/fi";
import { findProduct, loadProducts } from "@/lib/data";
import { SKIN_GUIDES } from "@/lib/seo-pages";
import { absoluteUrl, productPath } from "@/lib/site";
import SaveProductButton from "@/components/save-product-button";
import Header from "@/components/header";
import ProductGallery from "@/components/product-gallery";
import ProductScoreBadge from "@/components/product-score-badge";
import RetailerPriceCompare from "@/components/retailer-price-compare";
import SimilarProducts from "@/components/similar-products";
import MobileProductDetails from "@/components/mobile-product-details";
import ProductViewTracker from "@/components/tracking/product-view-tracker";

export const dynamicParams = false;

function descriptionFor(product) {
  const description = product.product_description
    || `${product.product_name} by ${product.brand_name}, listed in the Roopsee skincare catalog.`;
  return description.length > 158 ? `${description.slice(0, 155).trim()}...` : description;
}

function priceAmount(product) {
  const value = product.sp || product.mrp;
  const number = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? Math.ceil(number) : null;
}

function numericValue(raw) {
  const number = Number(String(raw || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function generateStaticParams() {
  const products = await loadProducts();
  return products.map((product) => ({ uid: product.product_uid }));
}

export async function generateMetadata({ params }) {
  const { uid } = await params;
  const product = await findProduct(uid);
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
    <li className="flex min-w-0 items-baseline gap-2 py-2 sm:gap-3">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-[10.5px]">
        {label}
      </span>
      <span aria-hidden="true" className="mb-[3px] flex-1 border-b border-dotted border-slate-200" />
      <span className="min-w-0 break-words text-right text-[12.5px] font-semibold text-slate-800 sm:text-[13px]">{value}</span>
    </li>
  );
}

function SectionHeading({ index, icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2">
      {index ? (
        <span className="text-[13px] font-extrabold text-[#e08a7d]">{index}.</span>
      ) : (
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#e08a7d]" />
      )}
      <span className="text-[13px] font-bold tracking-wide text-slate-800">{title}</span>
    </div>
  );
}

export default async function ProductPage({ params }) {
  const { uid } = await params;
  const product = await findProduct(uid);
  if (!product) notFound();

  const price = priceAmount(product);
  const mrpValue = numericValue(product.mrp);
  const spValue = numericValue(product.sp);
  const hasDiscount = mrpValue && spValue && mrpValue > spValue;
  const percentOff = hasDiscount ? Math.round(((mrpValue - spValue) / mrpValue) * 100) : null;

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
    score: product.score,
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
    <div className="rps-pdp min-h-screen bg-[#FAF9F6] pb-10 text-slate-800">
      <ProductViewTracker product={product} />
      <Header className="hidden sm:block" />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />

      <div className="overflow-x-hidden">
      <div className="hidden sm:block mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 sm:pt-8 lg:px-10">
        <Link
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-[#e08a7d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e08a7d]"
          href="/AllProducts"
        >
          <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to products
        </Link>
      </div>

      {/* ------------------------------------------------------------- Hero split */}
      <div className="pdp-mobile-sheet mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10">
        <Link className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-[#e08a7d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e08a7d] sm:hidden" href="/AllProducts">
          <FiArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Back to products
        </Link>
        <div className="mt-0 grid gap-0 sm:mt-6 sm:gap-7 lg:mt-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12 lg:items-start">
          {/* Image column */}
          <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <ProductGallery
              alt={product.product_name}
              images={product.images?.length ? product.images : [product.image].filter(Boolean)}
            >
              <ProductScoreBadge />
              <SaveProductButton
                product={wishlistProduct}
                label=""
                trackSaveMyMatch
                className="pdp-heart-btn flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#d77465] shadow-sm transition hover:bg-white"
              />
            </ProductGallery>
            {/* <div className="mt-3 sm:mt-6">
              <a
                href="#buy-options"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full
                border border-transparent bg-[#f3a99a]
                 px-7 py-2 text-[10px] font-semibold tracking-wide text-white transition-all
                 hover:-translate-y-0.5 hover:bg-[#e08a7d] focus-visible:outline-2
                  focus-visible:outline-offset-4
                 focus-visible:outline-[#e08a7d] sm:w-[100%] sm:px-5
                 sm:py-3.5 sm:text-[13.5px]"
              >
                Buy Now
              </a>
            </div> */}

            <div className="mt-3 hidden rounded-3xl border border-slate-100
             bg-gradient-to-b from-rose-50/50 to-white p-6 lg:block">
              <div className="flex items-center gap-2">
                <FiStar aria-hidden="true" className="h-4 w-4 shrink-0 text-[#e08a7d]" />
                <span className="text-[13px] font-bold tracking-wide text-slate-800">Reasons for products score </span>
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
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#e08a7d] sm:text-[12px]">
              {product.brand_name || "Roopsee catalog product"}
            </span>

            <h2 className="mt-1 break-words text-[16px] font
            text-slate-950 sm:mt-2 font-lato sm:text-3xl">
              {product.product_name}
            </h2>

            <p className="mt-1 text-[11px] text-slate-500 sm:hidden">
              {product.sku_size || product.product_type || "Skincare product"}
            </p>
            <p className="mt-3 hidden max-w-xl break-words text-[14px] leading-relaxed text-slate-500 sm:block sm:text-[14.5px]">
              {product.product_description || descriptionFor(product)}
            </p>

            {/* Price */}
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1 sm:mt-5">
              {/* <span className="text-[15px] font-extrabold leading-none text-slate-900 sm:text-[1.9rem]">
                {product.mrp ? `Rs. ${Math.ceil(product.sp || product.mrp)}` : "Price not listed"}
              </span> */}
              {hasDiscount ? (
                <>
                  <span className="text-[14px] text-slate-400 line-through">
                    Rs. {Math.ceil(product.mrp)}
                  </span>
                  <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[12px] font-bold text-[#d77465]">
                    {percentOff}% off
                  </span>
                </>
              ) : null}
            </div>
            <p className="mt-1 hidden text-[12px] text-slate-400 sm:block">Inclusive of all taxes</p>

            {/* CTA — desktop / tablet button, hidden below lg since the mobile sticky bar covers it there */}

            <div id="buy-options">
              <RetailerPriceCompare
                catalogPrice={product.sp || product.mrp}
                productName={product.product_name}
                productUid={product.product_uid}
              />
            </div>

            {/* Signature: catalog spec "label" card */}
            {/* <div className="mt-4 rounded-none border-y border-slate-100 bg-white px-2 py-3 sm:mt-6 sm:rounded-[14px] sm:border sm:bg-slate-50/60 sm:px-5 sm:py-4">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 sm:text-[10.5px]">
                <FiTag aria-hidden="true" className="h-3.5 w-3.5 text-[#e08a7d]" />
                Catalog information
              </div>
              <ul className="mt-1 divide-y divide-slate-200/70">
                <SpecRow label="Category" value={product.category || "Not listed"} />
                <SpecRow label="Type" value={product.product_type || "Not listed"} />
                <SpecRow label="Size" value={product.sku_size || "Not listed"} />
                <SpecRow label="Use" value={product.when_to_use || "As directed"} />
                <SpecRow label="SKU" value={product.product_uid} />
              </ul>
            </div> */}
          </div>
        </div>

        {/* ------------------------------------------------- Retailer price compare */}
        {/* Renders nothing unless the strict matcher is confident this exact SKU
            (same brand, strength and size) exists at a retailer. */}

        <SimilarProducts product={product} />

        <MobileProductDetails
          description={product.product_description || descriptionFor(product)}
          heroIngredient={product.single_hero_ingredient}
          ingredients={product.ingredients}
          secondaryIngredients={secondaryIngredients}
          usageInstructions={product.usage_instructions}
        />

        {/* ---------------------------------------------------------- Detail rows */}
        <div className="mt-6 hidden min-w-0 rounded-3xl border border-slate-100 bg-white shadow-sm sm:mt-8 sm:block lg:mt-10">
          {/* Key ingredients */}
          <div className="hidden grid gap-3 border-b border-slate-100 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
            <SectionHeading icon={FiDroplet} title="KEY INGREDIENTS" />
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                {product.single_hero_ingredient ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#d77465]">
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
                  <p className="mt-2 break-words text-[12.5px] leading-relaxed text-slate-500">
                    {product.ingredients}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* How to use */}
          <div className="hidden grid gap-3 border-b border-slate-100 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
            <SectionHeading icon={FiInfo} title="HOW TO USE" />
            <p className="max-w-2xl break-words text-[14px] leading-relaxed text-slate-600 sm:text-[14.5px]">
              {product.usage_instructions || "Follow the directions printed on the product packaging."}
            </p>
          </div>

          {product.ingredient_cautions ? (
            <div className="grid gap-3 border-b border-slate-100 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
              <div className="flex items-center gap-2">
                <FiAlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="text-[13px] font-bold tracking-wide text-slate-800">CAUTIONS</span>
              </div>
              <div className="max-w-2xl rounded-xl border-l-4 border-amber-400 bg-amber-50 px-5 py-4">
                <p className="break-words text-[14px] leading-relaxed text-amber-900">
                  {product.ingredient_cautions}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 border-b border-slate-100 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
            <SectionHeading icon={FiShield} title="SAFETY NOTE" />
            <p className="max-w-2xl text-[13px] leading-relaxed text-slate-400 sm:text-[13.5px]">
              Product matching supports discovery and does not diagnose or treat a skin condition.
              Patch test when appropriate, follow the manufacturer&apos;s instructions, and consult a
              qualified healthcare professional for persistent, painful or worsening symptoms.
            </p>
          </div>

          <div className="grid gap-3 p-5 sm:gap-4 sm:p-7 lg:grid-cols-[200px_1fr] lg:gap-10">
            <SectionHeading icon={FiCompass} title="EXPLORE GUIDES" />
            <div className="flex flex-wrap gap-2">
              {SKIN_GUIDES.map((guide) => (
                <Link
                  className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-bold text-[#d77465] transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e08a7d]"
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
      </div>

      {/* --------------------------------------------------- Mobile sticky bar */}
    </div>
  );
}