import { loadProducts } from "@/lib/data";
import { SKIN_GUIDES, SKIN_TYPE_OPTION_PAGES } from "@/lib/seo-pages";
import { absoluteUrl, productPath } from "@/lib/site";

export default async function sitemap() {
  const lastModified = new Date("2026-07-24T00:00:00.000Z");
  const products = await loadProducts();
  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...SKIN_GUIDES.map((guide) => ({
      url: absoluteUrl(`/skincare-for/${guide.slug}`),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    })),
    ...SKIN_TYPE_OPTION_PAGES.map(({ skinType, option }) => ({
      url: absoluteUrl(`/${skinType}/${option}`),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(productPath(product.product_uid)),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    })),
  ];
}
