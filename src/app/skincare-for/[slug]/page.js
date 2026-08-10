/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import { recommend } from "@/lib/engine";
import { getSkinGuide, SKIN_GUIDES } from "@/lib/seo-pages";
import { absoluteUrl, productPath } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return SKIN_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const guide = getSkinGuide(slug);
  if (!guide) return {};
  const canonical = `/skincare-for/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: guide.title,
      description: guide.description,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
      images: ["/opengraph-image"],
    },
  };
}

function GuideProductCard({ product }) {
  const price = product.selling_price || product.mrp;
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {product.image
          ? <img alt={product.product_name} loading="lazy" src={product.image} />
          : <div className="image-fallback">R</div>}
        <div className={`score-badge ${product.score >= 80 ? "score-good" : product.score >= 60 ? "score-present" : "score-weak"}`}>
          <div>{Math.max(0, product.score)}<small>Match</small></div>
        </div>
      </div>
      <div className="product-body">
        <div>
          <h3>{product.product_name}</h3>
          <p className="product-meta">{product.brand_name} · {product.category} · {product.product_type}</p>
        </div>
        <div className="price-row">
          <span>{price ? `Rs. ${price}` : "Price unavailable"}</span>
        </div>
        <p className="product-copy">{product.match_label}. {product.hero_ingredient || "See the product page for ingredient information."}</p>
        <div className="tagline">
          <span className="tag">{product.when_to_use || "Routine"}</span>
          <span className="tag">{product.size || "Size unavailable"}</span>
        </div>
        <Link className="details-link" href={productPath(product.product_uid)}>View product details</Link>
      </div>
    </article>
  );
}

export default async function SkinGuidePage({ params }) {
  const { slug } = await params;
  const guide = getSkinGuide(slug);
  if (!guide) notFound();

  const response = recommend(guide.profile, 12);
  const canonical = absoluteUrl(`/skincare-for/${guide.slug}`);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: guide.title,
      description: guide.description,
      dateModified: "2026-07-24",
      about: [
        { "@type": "Thing", name: guide.profile.selectedSkinType },
        ...guide.profile.selectedFaceBodyConcerns.map((concern) => ({ "@type": "Thing", name: concern })),
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Matched products for ${guide.title}`,
      numberOfItems: response.products.length,
      itemListElement: response.products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(productPath(product.product_uid)),
        name: product.product_name,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      })),
    },
  ];

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <header>
        <div className="eyebrow">{guide.eyebrow}</div>
        <h1>{guide.title}</h1>
        <p>{guide.answer}</p>
      </header>

      <main className="guide-layout">
        <aside className="panel profile-panel">
          <div className="section-title">Profile used for these matches</div>
          <ul className="component-list">
            <li><span>Skin type</span><strong>{guide.profile.selectedSkinType}</strong></li>
            <li><span>Sensitive</span><strong>{guide.profile.selectedSensitive ? "Yes" : "No"}</strong></li>
            <li><span>Concern</span><strong>{guide.profile.selectedFaceBodyConcerns.join(", ")}</strong></li>
            <li><span>Age</span><strong>{guide.profile.age}</strong></li>
          </ul>
          <div className="actions">
            <Link className="primary" href="/">Create your own match profile</Link>
          </div>
          <div className="routine-section-title">Related guides</div>
          <div className="tagline">
            {SKIN_GUIDES.filter((item) => item.slug !== guide.slug).map((item) => (
              <Link className="tag" href={`/skincare-for/${item.slug}`} key={item.slug}>
                {item.eyebrow}
              </Link>
            ))}
          </div>
        </aside>

        <section className="panel shop-panel">
          <div className="studio-toolbar">
            <div className="studio-title">
              <h2>Top catalog matches</h2>
              <p>
                These products are ordered using the same profile-aware scoring rules as the
                interactive matcher. A higher score indicates stronger alignment with the selected profile.
              </p>
            </div>
            <div className="profile-pill">{response.total_matches} products checked</div>
          </div>
          <div className="product-grid">
            {response.products.map((product) => (
              <GuideProductCard key={product.product_uid} product={product} />
            ))}
          </div>
        </section>
      </main>

      <main className="guide-layout">
        <aside className="panel profile-panel">
          <div className="studio-title">
            <h2>How matching works</h2>
          </div>
          <p>
            Roopsee compares applicable age, concern, skin-type and special-condition scores for
            each live catalog product. The applicable components depend on the product type.
          </p>
          <p>
            A component scored at -100 remains a hard blocker instead of being averaged into a
            positive recommendation. Catalog matches support product discovery and are not a diagnosis.
          </p>
          <div className="warnings">
            Patch test when appropriate and seek qualified medical advice for persistent, painful,
            severe or worsening skin symptoms.
          </div>
        </aside>

        <section className="panel shop-panel">
          <div className="studio-title">
            <h2>Frequently asked questions</h2>
            <p>Short answers to common questions about this skin profile.</p>
          </div>
          {guide.faqs.map(([question, answer]) => (
            <section key={question}>
              <div className="routine-section-title">{question}</div>
              <p>{answer}</p>
            </section>
          ))}
          <p><small>Catalog and matching guidance updated July 2026.</small></p>
        </section>
      </main>
    </>
  );
}
