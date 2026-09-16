'use client'

import { useState } from 'react'
import RefreshPricesButton from '@/components/refresh-prices-button'
import RetailerLogo from '@/components/retailer-logo'
import TypicalPriceRange from '@/components/typical-price-range'

function currentPrice(item) {
  return Number(item.selling_price) > 0 ? Number(item.selling_price) : Number(item.mrp) > 0 ? Number(item.mrp) : null
}

function formatPrice(price) {
  return price > 0 ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.ceil(price)) : 'Price unavailable'
}

export default function RetailerPriceComparison({ productId, initialRows }) {
  const [rows, setRows] = useState(initialRows)
  const [status, setStatus] = useState('')
  const [results, setResults] = useState([])
  const updatePrices = (nextResults) => {
    setResults(nextResults)
    setRows(previous => previous.map(row => {
      const result = nextResults.find(item => String(item.id) === String(row.id))
      if (!result?.ok) return row
      const { selling_price, mrp, discount, in_stock } = result.data
      return { ...row, selling_price, mrp, discount_pct: discount,
        in_stock: in_stock ?? row.in_stock }
    }))
  }
  const primary = rows.find(row => String(row.id) === String(productId)) || rows[0]
  const prices = rows.filter(row => row.in_stock !== false).map(currentPrice).filter(price => price !== null)
  const lowest = prices.length ? Math.min(...prices) : null
  const highest = prices.length ? Math.max(...prices) : null
  return (
    <>
      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1 sm:mt-5">
        <span className="text-[15px] font-extrabold leading-none text-slate-900 sm:text-[1.9rem]">{formatPrice(currentPrice(primary))}</span>
        {primary.in_stock === false ? <span className="text-xs text-red-600">Out of stock</span> : null}
      </div>
      <p className="mt-1 hidden text-[12px] text-slate-400 sm:block">Inclusive of all taxes</p>
      <TypicalPriceRange currentPrice={currentPrice(primary)} prices={prices} />
      <div id="buy-options" className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-extrabold uppercase tracking-wider text-slate-400">Compare prices</p>
          <div className="flex shrink-0 items-center gap-2">
            {highest > lowest && lowest !== null ? <p className="text-[13px] text-slate-400">{formatPrice(lowest)} – {formatPrice(highest)}</p> : null}
            <RefreshPricesButton productId={productId} onResults={updatePrices} onStatus={setStatus} />
          </div>
        </div>
        <p role="status" aria-live="polite" className="mt-2 text-xs text-slate-500">{status}</p>
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
          {rows.map(item => {
            const price = currentPrice(item)
            const isLowest = item.in_stock !== false && lowest !== null && price === lowest
            const result = results.find(result => String(result.id) === String(item.id))
            return (
              <li key={item.id} className={'flex items-center gap-3 px-3 py-3 sm:px-4 ' + (isLowest ? 'bg-[#D17A6D]/6' : 'bg-white')}>
                <div className="min-w-0 flex-1">
                  <RetailerLogo site={item.site} height={46} />
                  <p className="mt-1 truncate text-[13px] text-slate-400">{String(item.id) === String(productId) ? 'You are viewing this' : item.variant || 'Standard size'}</p>
                  {result ? <p className={'text-xs ' + (result.ok ? 'text-emerald-700' : 'text-amber-700')}>{result.ok ? 'Refreshed' : 'Refresh failed · previous price kept'}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[17px] font-bold text-slate-900">{formatPrice(price)}</p>
                  {Number(item.mrp) > price && price !== null ? <p className="text-xs text-slate-400">MRP <s>{formatPrice(item.mrp)}</s></p> : null}
                  {Number(item.discount_pct) > 0 ? <p className="text-xs text-emerald-700">{item.discount_pct}% off</p> : null}
                  <p className="text-xs text-slate-500">{item.in_stock === false ? 'Out of stock' : item.in_stock === true ? 'In stock' : 'Stock unconfirmed'}</p>
                  {isLowest ? <p className="text-[12px] font-bold uppercase text-emerald-700">Lowest</p> : null}
                </div>
                {item.product_url && item.in_stock !== false ? (
                  <a href={item.product_url} target="_blank" rel="noopener noreferrer nofollow sponsored" className="shrink-0 rounded-full border border-[#e08a7d] px-3.5 py-1.5 text-[14px] font-semibold text-[#d77465] transition-colors hover:bg-[#e08a7d] hover:text-white">Buy now</a>
                ) : null}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-[13px] text-slate-400">Compared only when the barcode, or the brand, product name and size, match.</p>
      </div>
    </>
  )
}
