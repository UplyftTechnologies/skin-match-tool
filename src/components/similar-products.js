import { FiShoppingBag } from "react-icons/fi";
import { findSimilarProducts } from "@/lib/data";
import SimilarProductsList from "@/components/similar-products-list";

export default function SimilarProducts({ product }) {
  const similar = findSimilarProducts(product, 8);
  if (!similar.length) return null;

  return (
    <div className="mt-6 min-w-0 bg-white p-3 sm:mt-8 sm:rounded-2xl sm:border sm:border-slate-100 sm:p-5 sm:shadow-sm">
      <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">
        <FiShoppingBag aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#e08a7d]" />
        You may also like
      </p>

      <SimilarProductsList products={similar} />
    </div>
  );
}
