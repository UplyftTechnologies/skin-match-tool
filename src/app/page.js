import MatchStudio from "@/components/match-studio";
import { DEFAULT_PROFILE } from "@/lib/default-profile";
import { recommend } from "@/lib/engine";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site";

export default function Home() {
  const initialData = recommend(DEFAULT_PROFILE, 500);
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
  ];

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <MatchStudio initialData={initialData} />
    </>
  );
}
