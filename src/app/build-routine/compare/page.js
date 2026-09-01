import Link from "next/link";
import Image from "next/image";
import { FiArrowLeft, FiExternalLink } from "react-icons/fi";
import Header from "@/components/header";
import RetailerLogo from "@/components/retailer-logo";
import { siteName } from "@/lib/site-name";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findComparableProducts } from "@/lib/retailer-product-match";

export const dynamic = "force-dynamic";

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Math.ceil(amount))
    : null;
}

// Looked up by id in one query, then put back in the order the shopper
// picked them so the routine's step order survives onto this page.
async function getProductsByIds(ids) {
  if (!ids.length) return [];

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select("*")
    .in("id", ids);

  if (error) {
    console.error("Failed to fetch routine products for comparison:", error.message);
    return [];
  }

  const byId = new Map((data || []).map((row) => [String(row.id), row]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

export default async function BuildRoutineComparePage({ searchParams }) {
  const params = await searchParams;
  const rawIds = params?.productUid;
  const ids = [...new Set(
    (Array.isArray(rawIds) ? rawIds : [rawIds]).filter(Boolean),
  )];

  const products = await getProductsByIds(ids);
  const comparisons = await Promise.all(
    products.map(async (product) => ({
      product,
      offers: await findComparableProducts(product),
    })),
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-800">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/build-routine"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#e08a7d]"
        >
          <FiArrowLeft aria-hidden="true" />
          Back to my routine
        </Link>

        <h1 className="mt-4 font-lato text-2xl font-semibold text-gray-900 sm:text-3xl">
          Compare your routine
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Prices for each product in your routine, across the retailers we track.
        </p>

        {!comparisons.length ? (
          <p className="mt-10 text-center text-sm text-gray-400">
            Add products to your routine, then come back here to compare prices.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {comparisons.map(({ product, offers }) => {
              const prices = offers.map((item) => Number(item.mrp)).filter(Number.isFinite);
              const lowestPrice = prices.length ? Math.min(...prices) : null;

              return (
                <div key={product.id} className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-contain"
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        {product.brand || product.site}
                      </p>
                      <Link
                        href={`/retailer-products/${product.id}`}
                        className="block truncate text-sm font-semibold text-gray-900 hover:text-[#e08a7d]"
                      >
                        {product.product_name}
                      </Link>
                    </div>
                  </div>

                  {offers.length > 1 ? (
                    <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
                      {offers.map((offer) => {
                        const price = Number(offer.mrp);
                        const isLowest = lowestPrice !== null && price === lowestPrice;
                        return (
                          <li
                            key={offer.id}
                            className={`flex items-center gap-3 px-3 py-3 ${isLowest ? "bg-rose-50/60" : "bg-white"}`}
                          >
                            <div className="min-w-0 flex-1">
                              <RetailerLogo site={offer.site} height={40} />
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[14px] font-bold text-slate-900">
                                {formatPrice(offer.mrp) || "—"}
                              </p>
                              {isLowest ? (
                                <p className="text-[10px] font-bold uppercase text-emerald-700">Lowest</p>
                              ) : null}
                            </div>
                            {offer.product_url ? (
                              <a
                                href={offer.product_url}
                                target="_blank"
                                rel="noopener noreferrer nofollow sponsored"
                                className="shrink-0 rounded-full border border-[#e08a7d] px-3.5 py-1.5 text-[12px] font-semibold text-[#d77465] transition-colors hover:bg-[#e08a7d] hover:text-white"
                              >
                                Buy now
                              </a>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-gray-400">
                      Only found at {siteName(product.site)} right now.
                      {product.product_url ? (
                        <a
                          href={product.product_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow sponsored"
                          className="ml-1 inline-flex items-center gap-1 font-semibold text-[#d77465] hover:underline"
                        >
                          View <FiExternalLink aria-hidden="true" className="h-3 w-3" />
                        </a>
                      ) : null}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
