import Link from "next/link";
import Header from "@/components/header";
import { SKIN_GUIDES } from "@/lib/seo-pages";
import { absoluteUrl } from "@/lib/site";

const faqs = [
  {
    question: "How is the product match score calculated?",
    answer:
      "Each product is scored against your skin type, sensitivity, primary concern and selected special conditions. A higher score indicates stronger alignment with the profile you provided.",
  },
  {
    question: "Is Match My Skin free to use?",
    answer:
      "Yes. The skin quiz and recommendations are free, and no login is required to view your results.",
  },
  {
    question: "Do I need to create an account?",
    answer:
      "No. An account is optional and is only needed when you want to save your profile and revisit saved products.",
  },
  {
    question: "What skin concerns does the tool cover?",
    answer:
      "It covers concerns including acne, dryness, open pores, dark spots, redness, dullness, uneven tone, wrinkles, dehydration and skin barrier support.",
  },
];

export const metadata = {
  title: "How Match My Skin Works",
  description:
    "Learn how the free Match My Skin quiz compares skincare products, calculates profile-specific match scores and builds morning and night routines.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    type: "website",
    url: "/how-it-works",
    title: "How Match My Skin Works",
    description:
      "See how Roopsee compares skincare products for your skin profile and builds practical routines.",
    images: ["/opengraph-image"],
  },
};

export default function HowItWorksPage() {
  const canonical = absoluteUrl("/how-it-works");
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: "How Match My Skin Works",
      description:
        "How Roopsee compares skincare products and creates profile-specific match scores and routines.",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: faqs.map(({ question, answer }) => ({
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
      <Header />
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />

      <main className="how-it-works-page">
        <section aria-labelledby="how-it-works" className="seo-content-section">
          <p className="seo-eyebrow">Free skincare matching tool</p>
          <h1 id="how-it-works">How Match My Skin works</h1>
          <p>
            Match My Skin compares products from Roopsee&apos;s skincare catalog
            against your skin type, sensitivity, main concern, age group and
            selected conditions. After the short quiz, products are ranked with
            a match score and organised into practical morning and night routines.
          </p>

          <div className="seo-steps" aria-label="How to get skincare matches">
            <article><span>1</span><h2>Describe your skin</h2><p>Select your skin type, sensitivity and primary concern.</p></article>
            <article><span>2</span><h2>Compare matches</h2><p>Review ranked products and understand their profile-specific scores.</p></article>
            <article><span>3</span><h2>Build a routine</h2><p>Use the suggested order to create a simple morning or night routine.</p></article>
          </div>

          <div className="seo-page-cta">
            <h2>Ready to find your matches?</h2>
            <p>Complete the free quiz and compare products selected for your profile.</p>
            <Link className="seo-primary-link" href="/">Start the skin match quiz</Link>
          </div>

          <div className="seo-guide-block">
            <h2>Explore skincare guides by concern</h2>
            <div className="seo-guide-links">
              {SKIN_GUIDES.map((guide) => (
                <Link href={`/skincare/${guide.slug}`} key={guide.slug}>
                  {guide.title}
                </Link>
              ))}
            </div>
          </div>

          <div className="seo-faq-block">
            <h2>Frequently asked questions</h2>
            {faqs.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>

          <p className="seo-disclaimer">
            Match results support product discovery and are not a medical diagnosis.
            Consult a qualified dermatologist for persistent, painful or worsening symptoms.
          </p>
        </section>
      </main>
    </>
  );
}
