'use client'

import { useRef, useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { readPriceStream } from '@/lib/price-stream'

export default function RefreshPricesButton({ productId, onResults, onStatus }) {
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const handleClick = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    onResults?.([])
    onStatus?.('Refreshing retailer prices…')
    try {
      const response = await fetch('/api/retailer-products/rescrape', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ id: productId }), signal: AbortSignal.timeout(55000),
      })
      if (!response.ok) throw new Error('Price refresh failed.')
      let data
      if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
        const received = new Map()
        let complete = false
        let total = 0
        await readPriceStream(response.body, event => {
          if (event.type === 'start') total = event.attempted
          if (event.type === 'error') throw new Error('Price refresh interrupted.')
          if (event.type === 'result') {
            received.set(String(event.result.id), event.result)
            onResults?.([...received.values()])
            onStatus?.(`Checked ${received.size} of ${total} retailers…`)
          }
          if (event.type === 'complete') complete = true
        })
        if (!complete) throw new Error('Incomplete price response.')
        data = { results: [...received.values()] }
      } else {
        data = await response.json()
      }
      if (!response.ok || !Array.isArray(data.results)) throw new Error('Price refresh failed.')
      onResults?.(data.results)
      const succeeded = data.results.filter(result => result.ok).length
      onStatus?.(succeeded === data.results.length && succeeded > 0
        ? 'Prices refreshed successfully.'
        : succeeded + ' of ' + data.results.length + ' retailers refreshed. Previous prices kept for unsuccessful retailers.')
    } catch {
      onStatus?.('Refresh interrupted. Completed updates have been kept; other prices are unchanged. Please try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <button type="button" onClick={handleClick} disabled={busy} aria-label="Refresh prices" aria-busy={busy}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-[#e08a7d] hover:text-[#d77465] disabled:opacity-60">
      <FiRefreshCw aria-hidden="true" className={'h-3 w-3 ' + (busy ? 'animate-spin' : '')} />
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}
