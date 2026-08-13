import MatchStudio from "@/app/MatchStudio/page.js";
import AllProduct from "@/app/AllProducts/page.js";
import Header from "@/components/header";
import { DEFAULT_PROFILE } from "@/lib/default-profile";
import { recommend } from "@/lib/engine";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site";
import FooterPage from "./footer/page";

export default async function Home() {
  const initialData = await recommend(DEFAULT_PROFILE, 500);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Roopsee",
      url: SITE_URL,
      description: "Roopsee helps shoppers compare skincare products using profile-specific catalog scores.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#application`,
      name: SITE_NAME,
      url: absoluteUrl("/"),
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      description: "An interactive skincare product matcher that compares live catalog products by skin type, sensitivity, age and concern.",
      isAccessibleForFree: true,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "How is the product match score calculated?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Each product is scored against your skin type, sensitivity, primary concern, and any special conditions you select (like pregnancy or excessive dryness). Products scoring 80 and above are labelled \"Great\" matches, 60-79 are a caution zone, and anything below 60 typically isn't recommended for your profile.",
          },
        },
        {
          "@type": "Question",
          name: "Is Match My Skin free to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The skin match quiz and product recommendations are completely free, with no login required to see your results.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need to create an account?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No account is required to take the quiz or view your matches. You can optionally sign in to save your skin profile and revisit your results later.",
          },
        },
        {
          "@type": "Question",
          name: "What skin concerns does the tool cover?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The matcher covers acne, body acne, dryness, open pores, dark spots, redness, tanning, dullness, uneven skin tone, comedones, wrinkles, melasma, dehydration and barrier repair.",
          },
        },
      ],
    },
  ];

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <Header/>
      <MatchStudio initialData={initialData} />


      <section className="seo-content-section hidden" style={{ maxWidth: 960, margin: "0 auto", padding: "48px 20px" }}>
        <h2>How the Roopsee Skin Match Studio works</h2>
        <p>
          Match My Skin is a free tool that recommends skincare products based on
          your skin type, sensitivity, main concern, age and gender. Answer four
          quick questions and get a ranked list of products from Roopsee&apos;s
          catalog, each scored out of 100 for how well it fits your profile,
          along with a suggested morning and night routine.
        </p>

        <h3>Frequently asked questions</h3>

        <h4>How is the product match score calculated?</h4>
        <p>
          Each product is scored against your skin type, sensitivity, primary
          concern, and any special conditions you select (like pregnancy or
          excessive dryness). Products scoring 80 and above are labelled
          &quot;Great&quot; matches, 60&ndash;79 are a caution zone, and anything
          below 60 typically isn&apos;t recommended for your profile.
        </p>

        <h4>Is Match My Skin free to use?</h4>
        <p>Yes. The skin match quiz and product recommendations are completely free, with no login required to see your results.</p>

        <h4>Do I need to create an account?</h4>
        <p>
          No account is required to take the quiz or view your matches. You can
          optionally sign in to save your skin profile and revisit your results later.
        </p>

        <h4>What skin concerns does the tool cover?</h4>
        <p>
          The matcher covers acne, body acne, dryness, open pores, dark spots,
          redness, tanning, dullness, uneven skin tone, comedones, wrinkles,
          melasma, dehydration and barrier repair.
        </p>
      </section>

      <FooterPage />
    </>
  );
}
