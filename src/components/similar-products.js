import { findSimilarProducts } from "@/lib/data";
import SimilarProductsList from "@/components/similar-products-list";

export default async function SimilarProducts({ product }) {
  const similar = await findSimilarProducts(product, 8);
  if (!similar.length) return null;

  return <SimilarProductsList products={similar} />;
}
