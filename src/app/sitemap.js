import { loadProducts } from "@/lib/data";
import { SKIN_GUIDES } from "@/lib/seo-pages";
import { absoluteUrl, productPath } from "@/lib/site";

export default function sitemap() {
  const lastModified = new Date("2026-07-24T00:00:00.000Z");
  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/how-it-works"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...SKIN_GUIDES.map((guide) => ({
      url: absoluteUrl(`/skincare-for/${guide.slug}`),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    })),
    ...loadProducts().map((product) => ({
      url: absoluteUrl(productPath(product.product_uid)),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    })),
  ];
}
