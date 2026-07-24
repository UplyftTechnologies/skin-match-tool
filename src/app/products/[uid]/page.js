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

export default async function ProductPage({ params }) {
  const { uid } = await params;
  const product = findProduct(uid);
  if (!product) notFound();

  const price = priceAmount(product);
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

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <header>
        <Link className="back-link" href="/">← Back to matches</Link>
        <div className="eyebrow">{product.brand_name || "Roopsee catalog product"}</div>
        <h1>{product.product_name}</h1>
        <p>{product.product_description || descriptionFor(product)}</p>
      </header>

      <main>
        <aside className="panel profile-panel">
          <div className="product-image-wrap">
            {product.image
              ? <img alt={product.product_name} src={product.image} />
              : <div className="image-fallback">R</div>}
          </div>
          <div className="section-title">Catalog information</div>
          <ul className="component-list">
            <li><span>Brand</span><strong>{product.brand_name || "Not listed"}</strong></li>
            <li><span>Category</span><strong>{product.category || "Not listed"}</strong></li>
            <li><span>Product type</span><strong>{product.product_type || "Not listed"}</strong></li>
            <li><span>Size</span><strong>{product.sku_size || "Not listed"}</strong></li>
            <li><span>Price</span><strong>{product.sp || product.mrp ? `Rs. ${product.sp || product.mrp}` : "Not listed"}</strong></li>
            <li><span>Use</span><strong>{product.when_to_use || "Follow product directions"}</strong></li>
          </ul>
          <div className="actions">
            <Link className="secondary" href="/">Find my personalised matches</Link>
          </div>
        </aside>

        <section className="panel shop-panel">
          <div className="studio-title">
            <h2>Product details</h2>
            <p>Catalog information to help you evaluate this product before adding it to a routine.</p>
          </div>

          <div className="routine-section-title">Key ingredients</div>
          <p><strong>Hero ingredient:</strong> {product.single_hero_ingredient || "Not listed"}</p>
          <p><strong>Secondary ingredients:</strong> {product.secondary_hero_ingredients || "Not listed"}</p>
          <p><strong>Full ingredient list:</strong> {product.ingredients || "Not listed"}</p>

          <div className="routine-section-title">How to use</div>
          <p>{product.usage_instructions || "Follow the directions printed on the product packaging."}</p>

          {product.ingredient_cautions ? (
            <>
              <div className="routine-section-title">Ingredient cautions</div>
              <div className="warnings">{product.ingredient_cautions}</div>
            </>
          ) : null}

          <div className="routine-section-title">Important safety note</div>
          <p>
            Product matching supports discovery and does not diagnose or treat a skin condition.
            Patch test when appropriate, follow the manufacturer&apos;s instructions, and consult a
            qualified healthcare professional for persistent, painful or worsening symptoms.
          </p>

          <div className="routine-section-title">Explore skincare guides</div>
          <div className="tagline">
            {SKIN_GUIDES.map((guide) => (
              <Link className="tag" href={`/?guide=${guide.slug}#matcher`} key={guide.slug}>
                {guide.eyebrow}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
