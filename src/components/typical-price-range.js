import { FiTag } from "react-icons/fi";

function formatPrice(value) {
  const amount = Math.ceil(Number(value));
  if (!Number.isFinite(amount)) return null;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TypicalPriceRange({ currentPrice, prices }) {
  const validPrices = (prices || [])
    .map(Number)
    .filter((price) => Number.isFinite(price) && price > 0);
  const price = Number(currentPrice);

  if (!Number.isFinite(price) || price <= 0 || validPrices.length < 2) return null;

  const lowestPrice = Math.min(...validPrices);
  const highestPrice = Math.max(...validPrices);
  const rangePadding = Math.max(10, Math.round((highestPrice - lowestPrice) * 0.2));
  const rangeStart = Math.max(0, lowestPrice - rangePadding);
  const rangeEnd = highestPrice + rangePadding;
  const pricePosition = Math.min(
    96,
    Math.max(4, ((price - rangeStart) / (rangeEnd - rangeStart || 1)) * 100),
  );

  return (
    <div className="mt-5 min-w-0 bg-white p-1 sm:rounded-2xl sm:p-5">
      <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">
        <FiTag aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#f59e0b]" />
        This price is <span className="text-[#f26f5b]">typical.</span>
      </p>

      <div className="relative mt-7 px-1">
        <span
          className="absolute -top-5 -translate-x-1/2 rounded bg-orange-100 px-1.5 py-0.5 text-[8px] font-semibold text-[#ec7b20]"
          style={{ left: `${pricePosition}%` }}
        >
          {formatPrice(price)} is typical
        </span>
        <span className="block h-1 rounded-full bg-gradient-to-r from-[#198754] via-[#ff9517] to-[#ff2d63]" />
        <span
          className="absolute top-[-3px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-[#ff9517] shadow"
          style={{ left: `${pricePosition}%` }}
        />
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-600">
          <span>{formatPrice(rangeStart)}</span>
          <span>{formatPrice(rangeEnd)}</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-tight text-slate-700">
        Similar items cost approximately between {formatPrice(lowestPrice)} and {formatPrice(highestPrice)}.
      </p>
    </div>
  );
}
