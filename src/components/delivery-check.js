'use client'

import { useRef, useState } from 'react'
import { FiMapPin } from 'react-icons/fi'
import { readPriceStream } from '@/lib/price-stream'

const PINCODE = /^[1-9]\d{5}$/

// Mirrors RefreshPricesButton's request/stream/guard pattern — same NDJSON
// stream reader, same duplicate-request guard — just pointed at the
// delivery-check endpoint instead of the price-refresh one.
export default function DeliveryCheck({ productId, onResults, onStatus }) {
  const [pincode, setPincode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  const handleCheck = async (event) => {
    event.preventDefault()
    if (inFlight.current) return

    const trimmed = pincode.trim()
    if (!PINCODE.test(trimmed)) {
      setError('Enter a valid 6-digit pincode.')
      return
    }

    inFlight.current = true
    setBusy(true)
    setError('')
    onResults?.(trimmed, [])
    onStatus?.('Checking delivery options…')

    try {
      const response = await fetch('/api/retailer-products/delivery-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ id: productId, pincode: trimmed }), signal: AbortSignal.timeout(80000),
      })
      if (!response.ok) {
        const failure = await response.json().catch(() => null)
        throw new Error(failure?.error || 'Delivery check failed.')
      }

      const received = new Map()
      let complete = false
      let total = 0
      await readPriceStream(response.body, (event) => {
        if (event.type === 'start') total = event.attempted
        if (event.type === 'error') throw new Error('Delivery check interrupted.')
        if (event.type === 'result') {
          received.set(String(event.result.id), event.result)
          onResults?.(trimmed, [...received.values()])
          onStatus?.(`Checked ${received.size} of ${total} retailers…`)
        }
        if (event.type === 'complete') complete = true
      })
      if (!complete) throw new Error('Incomplete delivery response.')

      const succeeded = [...received.values()].filter((result) => result.ok).length
      onStatus?.(succeeded === received.size && succeeded > 0
        ? 'Delivery options updated.'
        : `${succeeded} of ${received.size} retailers checked. Others could not be reached.`)
    } catch (err) {
      const message = err.name === 'TimeoutError' ? 'Delivery check took too long, try again.' : err.message
      setError(message)
      onStatus?.('')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-700">
        <FiMapPin aria-hidden="true" className="h-4 w-4 text-[#d77465]" />
        Delivery Options
      </div>
      <form
        onSubmit={handleCheck}
        className="mt-2 flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter pincode"
          value={pincode}
          onChange={(event) => setPincode(event.target.value.replace(/\D/g, ''))}
          aria-label="Delivery pincode"
          className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[14px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="shrink-0 px-4 py-2.5 text-[14px] font-bold text-[#d77465] transition hover:text-[#c2604f] disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
