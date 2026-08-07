import Link from "next/link";
import { notFound } from "next/navigation";
import { recommend } from "@/lib/engine";
import { getSkinTypeOptionGuide, SKIN_TYPE_OPTION_PAGES } from "@/lib/seo-pages";
import { absoluteUrl, productPath } from "@/lib/site";
import SeoProductCard from "./SeoProductCard";

export const dynamicParams = false;

export function generateStaticParams() {
  return SKIN_TYPE_OPTION_PAGES;
}

export async function generateMetadata({ params }) {
  const { skinType, option } = await params;
  const guide = getSkinTypeOptionGuide(skinType, option);
  if (!guide) return {};
  const canonical = `/${skinType}/${option}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical },
    openGraph: { type: "article", url: canonical, title: guide.title, description: guide.description, images: ["/opengraph-image"] },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description, images: ["/opengraph-image"] },
  };
}

export default async function SkinTypeOptionPage({ params }) {
  const { skinType, option } = await params;
  const guide = getSkinTypeOptionGuide(skinType, option);
  if (!guide) notFound();

  const response = recommend(guide.profile, 12);
  const canonical = absoluteUrl(`/${skinType}/${option}`);
  const structuredData = [
    {
      "@context": "https://schema.org", "@type": "WebPage", "@id": `${canonical}#webpage`,
      url: canonical, name: guide.title, description: guide.description,
      about: [{ "@type": "Thing", name: `${guide.skinType} skin` }, { "@type": "Thing", name: guide.topic }],
    },
    {
      "@context": "https://schema.org", "@type": "ItemList", name: `Matched products for ${guide.skinType} skin and ${guide.topic}`,
      numberOfItems: response.products.length,
      itemListElement: response.products.map((product, index) => ({ "@type": "ListItem", position: index + 1, url: absoluteUrl(productPath(product.product_uid)), name: product.product_name })),
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: guide.faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header>
        <div className="eyebrow">{guide.skinType} skin · {guide.topic}</div>
        <h1>{guide.title}</h1>
        <p>{guide.answer}</p>
      </header>
      <main className="guide-layout">
        <aside className="panel profile-panel">
          <div className="section-title">Profile used for these matches</div>
          <ul className="component-list">
            <li><span>Skin type</span><strong>{guide.skinType}</strong></li>
            <li><span>Quiz option</span><strong>{guide.topic}</strong></li>
          </ul>
          <div className="actions"><Link className="primary" href="/">Create your own match profile</Link></div>
          <div className="routine-section-title">Related skin types</div>
          <div className="tagline">
            {["oily", "dry", "normal", "combination"].filter((item) => item !== skinType).map((item) => (
              <Link className="tag" href={`/${item}/${option}`} key={item}>{item[0].toUpperCase() + item.slice(1)} skin</Link>
            ))}
          </div>
        </aside>
        <section className="panel shop-panel">
          <div className="studio-toolbar"><div className="studio-title"><h2>Top catalog matches</h2><p>Products are ordered using the same profile-aware scoring rules as the interactive matcher.</p></div><div className="profile-pill">{response.total_matches} products checked</div></div>
          <div className="product-grid">{response.products.map((product) => <SeoProductCard key={product.product_uid} product={product} section={`seo_${skinType}_${option}`} />)}</div>
        </section>
      </main>
      <main className="guide-layout">
        <aside className="panel profile-panel">
          <div className="studio-title"><h2>How matching works</h2></div>
          <p>Roopsee compares the catalog scores that apply to this skin profile. A higher score indicates stronger alignment; a hard blocker is never averaged into a positive recommendation.</p>
          <div className="warnings">Product matching supports discovery and is not a diagnosis. Patch test when appropriate and seek qualified advice for persistent or severe symptoms.</div>
        </aside>
        <section className="panel shop-panel">
          <div className="studio-title"><h2>Frequently asked questions</h2><p>Short answers for this skin profile.</p></div>
          {guide.faqs.map(([question, answer]) => <section key={question}><div className="routine-section-title">{question}</div><p>{answer}</p></section>)}
        </section>
      </main>
    </>
  );
}
