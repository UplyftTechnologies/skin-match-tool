'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FiRefreshCw } from 'react-icons/fi'

// Re-runs this server-rendered page's data fetch (the page is
// `force-dynamic`, so a fresh render always re-reads the latest retailer
// prices from the DB) without a full browser reload.
export default function RefreshPricesButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-label="Refresh prices"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-[#e08a7d] hover:text-[#d77465] disabled:opacity-60"
    >
      <FiRefreshCw aria-hidden="true" className={`h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}
