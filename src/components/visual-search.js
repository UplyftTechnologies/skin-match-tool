'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FiCamera, FiImage, FiUploadCloud, FiX } from 'react-icons/fi'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import { productPath } from '@/lib/site'

// Phone cameras produce 3-5MB frames. The label text survives a downscale to
// 1280px easily, and shrinking before upload is the difference between a
// request that feels instant on mobile data and one that times out.
const MAX_EDGE = 1024
const JPEG_QUALITY = 0.78

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Could not read that file.'))
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(file)
    })
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Could not read that file.'))
        reader.onload = () => {
            const img = new window.Image()
            img.onerror = () => reject(new Error('That file is not a readable image.'))
            img.onload = () => {
                const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
                const canvas = document.createElement('canvas')
                canvas.width = Math.round(img.width * scale)
                canvas.height = Math.round(img.height * scale)
                const context = canvas.getContext('2d')
                context.drawImage(img, 0, 0, canvas.width, canvas.height)
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
            }
            img.src = reader.result
        }
        reader.readAsDataURL(file)
    })
}

// Tesseract's biggest weakness on packaging is resolution — measured against
// real product shots, upscaling and flattening to high-contrast grey lifted the
// hit rate more than any other change. This runs locally, so the larger canvas
// costs nothing but a moment of CPU.
const OCR_EDGE = 1600
const OCR_EDGE_LARGE = 2600

// Renders the photo at a given size, flattened to grey with its luminance range
// stretched across the full scale — what rescues dim or flatly-lit labels.
// `threshold` additionally forces every pixel to pure black or white, which
// reads cleanly on flat printed panels and badly on gradients, hence a pass of
// its own rather than a change to the default.
function renderForOcr(dataUrl, { edge = OCR_EDGE, threshold = null, preserveColor = false } = {}) {
    return new Promise((resolve) => {
        const img = new window.Image()
        img.onerror = () => resolve(dataUrl)
        img.onload = () => {
            const scale = edge / Math.max(img.width, img.height)
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const context = canvas.getContext('2d')
            context.drawImage(img, 0, 0, canvas.width, canvas.height)

            if (preserveColor && threshold === null) {
                resolve(canvas.toDataURL('image/png'))
                return
            }

            const frame = context.getImageData(0, 0, canvas.width, canvas.height)
            const pixels = frame.data
            let min = 255
            let max = 0
            for (let i = 0; i < pixels.length; i += 4) {
                const grey = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) | 0
                pixels[i] = grey
                if (grey < min) min = grey
                if (grey > max) max = grey
            }
            const span = Math.max(1, max - min)
            for (let i = 0; i < pixels.length; i += 4) {
                let value = ((pixels[i] - min) * 255) / span
                if (threshold !== null) value = value >= threshold ? 255 : 0
                pixels[i] = value
                pixels[i + 1] = value
                pixels[i + 2] = value
            }
            context.putImageData(frame, 0, 0)
            resolve(canvas.toDataURL('image/png'))
        }
        img.src = dataUrl
    })
}

// Four renderings of the same photo. Measured over 98 real product shots, no
// single pass reads everything — unioning all four lifted mean capture of the
// product name from 38% to 50%, and cut photos yielding nothing from 30% to
// 21%. They run in order of how often they pay off, so the common case still
// finishes after pass one.
const OCR_PASSES = [
    { label: 'color', render: { preserveColor: true }, psm: 'AUTO' },
    { label: 'block', render: {}, psm: 'SINGLE_BLOCK' },
    { label: 'sparse', render: {}, psm: 'SPARSE_TEXT' },
    { label: 'high-contrast', render: { threshold: 150 }, psm: 'AUTO' },
    { label: 'magnified', render: { edge: OCR_EDGE_LARGE }, psm: 'SINGLE_BLOCK' },
]

// Tesseract ships a few MB of wasm and language data, so it is imported only
// when a shopper actually opens the sheet on a deployment with no API key —
// never as part of the page bundle.
async function createOcrReader(onProgress) {
    const { createWorker, PSM } = await import('tesseract.js')
    // The logger is a worker-level option — `recognize`'s fourth argument is a
    // job id, not a callback, so progress has to be wired up here.
    const worker = await createWorker('eng', undefined, {
        logger: (message) => {
            if (message.status === 'recognizing text') onProgress(message.progress)
        },
    })
    let pageMode = null

    return {
        async read(dataUrl, pass) {
            const image = await renderForOcr(dataUrl, pass.render)
            const nextPageMode = PSM[pass.psm]
            if (nextPageMode !== pageMode) {
                await worker.setParameters({
                    tessedit_pageseg_mode: nextPageMode,
                })
                pageMode = nextPageMode
            }
            const { data } = await worker.recognize(image)
            return data.text || ''
        },
        terminate: () => worker.terminate(),
    }
}

export default function VisualSearch({ onQuery }) {
    const [open, setOpen] = useState(false)
    const [preview, setPreview] = useState('')
    const [status, setStatus] = useState('idle')
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const [mode, setMode] = useState('vision')
    const [progress, setProgress] = useState(0)
    const [pass, setPass] = useState(null)
    const cameraInput = useRef(null)
    const uploadInput = useRef(null)

    const close = useCallback(() => {
        setOpen(false)
        setPreview('')
        setResult(null)
        setError('')
        setStatus('idle')
        setProgress(0)
        setPass(null)
    }, [])

    // Ask once which path this deployment can use, before any photo is taken.
    useEffect(() => {
        if (!open) return
        let active = true
        fetch('/api/visual-search')
            .then((response) => response.json())
            .then((payload) => {
                if (active && payload?.mode) setMode(payload.mode)
            })
            .catch(() => {})
        return () => {
            active = false
        }
    }, [open])

    useEffect(() => {
        if (!open) return undefined
        function onKey(event) {
            if (event.key === 'Escape') close()
        }
        document.addEventListener('keydown', onKey)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = ''
        }
    }, [open, close])

    function showInProductGrid(payload) {
        const topMatch = payload.matches?.[0]
        // `product_name` in the retailer catalogue often already starts with
        // its brand. Adding the brand again created a duplicated, exact phrase
        // that the normal catalogue filter could not find.
        const query = topMatch?.product_name || payload.query

        if (!query || !onQuery) return false
        onQuery(query, {
            productUids: (payload.matches || []).map((item) => String(item.product_uid)),
        })
        close()
        return true
    }

    async function handleFile(event, source) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setError('')
        setResult(null)
        setStatus('working')
        trackingService.trackEvent(EVENTS.VISUAL_SEARCH_SUBMITTED, { source, mode })

        let dataUrl
        try {
            dataUrl = await compressImage(file)
            setPreview(dataUrl)
        } catch (compressError) {
            setStatus('idle')
            setError(compressError.message)
            return
        }

        async function askServer(body) {
            const response = await fetch('/api/visual-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const json = await response.json()
            if (!response.ok) throw new Error(json.error || 'Visual search failed.')
            return json
        }

        try {
            let payload
            if (mode === 'ocr') {
                // Each pass reads things the others miss, so text accumulates and
                // the catalogue is re-queried after every one. A clear photo
                // resolves on pass one and never pays for the rest.
                // OCR reads the untouched original — the 1280px preview has
                // already thrown away detail the deeper passes rely on.
                const original = await readAsDataUrl(file)
                const reader = await createOcrReader(setProgress)
                let scanned = ''
                try {
                    for (let index = 0; index < OCR_PASSES.length; index += 1) {
                        setStatus('scanning')
                        setPass({ index: index + 1, total: OCR_PASSES.length })
                        setProgress(0)

                        scanned += ` ${await reader.read(original, OCR_PASSES[index])}`
                        if (!scanned.trim()) continue

                        setStatus('working')
                        payload = await askServer({ text: scanned.trim() })
                        if (payload.matched) break
                    }
                } finally {
                    await reader.terminate()
                }
                if (!payload) throw new Error('No text could be read from that photo.')
            } else {
                setStatus('working')
                payload = await askServer({ image: dataUrl })
            }

            if (payload.matched) {
                trackingService.trackEvent(EVENTS.VISUAL_SEARCH_MATCHED, {
                    source,
                    mode,
                    brand: payload.extracted?.brand,
                    productName: payload.extracted?.product_name,
                    matchCount: payload.matches.length,
                    topMatch: payload.matches[0]?.product_name,
                })
                // Successful matches belong in the standard catalogue grid,
                // where shoppers can sort, filter and compare them normally.
                if (showInProductGrid(payload)) return
            } else {
                trackingService.trackEvent(EVENTS.VISUAL_SEARCH_NO_MATCH, {
                    source,
                    mode,
                    reason: payload.reason || 'no_catalog_match',
                    brand: payload.extracted?.brand,
                })
            }

            setResult(payload)
            setStatus('done')
        } catch (requestError) {
            setStatus('idle')
            setError(requestError.message)
            trackingService.trackEvent(EVENTS.VISUAL_SEARCH_FAILED, {
                source,
                mode,
                message: requestError.message,
            })
        }
    }

    function searchByText() {
        if (result?.query && onQuery) onQuery(result.query, { productUids: [] })
        close()
    }

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setOpen(true)
                    trackingService.trackEvent(EVENTS.VISUAL_SEARCH_OPENED, {})
                }}
                aria-label="Search by photo"
                title="Search by photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#e08a7d] transition-colors hover:bg-[#f8eeeb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e08a7d]"
            >
                <FiCamera size={18} aria-hidden="true" />
            </button>

            <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => handleFile(event, 'camera')}
            />
            <input
                ref={uploadInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFile(event, 'upload')}
            />

            {open ? (
                <div
                    className="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Search by photo"
                    onClick={close}
                >
                    <div
                        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-safe-5 shadow-xl sm:rounded-3xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-800">Search by photo</h2>
                            <button
                                type="button"
                                onClick={close}
                                aria-label="Close"
                                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <FiX size={18} aria-hidden="true" />
                            </button>
                        </div>

                        {status === 'idle' && !preview ? (
                            <>
                                <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
                                    {mode === 'ocr'
                                        ? 'Hold the pack straight on, fill the frame, and keep the brand name in focus. Reading happens on your phone, so a sharp photo matters.'
                                        : 'Point at the front of the pack so the brand and product name are readable.'}
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => cameraInput.current?.click()}
                                        className="flex flex-col items-center gap-2 rounded-2xl border border-[#f0d9d3] bg-[#fdf7f5] px-4 py-6 text-[13px] font-semibold text-[#d77465] transition-colors hover:bg-[#f8eeeb]"
                                    >
                                        <FiCamera size={22} aria-hidden="true" />
                                        Take a photo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => uploadInput.current?.click()}
                                        className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                                    >
                                        <FiUploadCloud size={22} aria-hidden="true" />
                                        Upload a photo
                                    </button>
                                </div>
                            </>
                        ) : null}

                        {preview ? (
                            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={preview}
                                    alt="Your photo"
                                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                                />
                                <div className="min-w-0 text-[13px]">
                                    {status === 'scanning' ? (
                                        <span className="text-slate-500">
                                            Reading the label… {Math.round(progress * 100)}%
                                            {pass && pass.index > 1 ? (
                                                <span className="text-slate-400">
                                                    {' '}· deeper scan {pass.index}/{pass.total}
                                                </span>
                                            ) : null}
                                        </span>
                                    ) : status === 'working' ? (
                                        <span className="text-slate-500">Matching to our catalogue…</span>
                                    ) : error ? (
                                        // The request never got far enough to read anything, so say
                                        // nothing here and let the error below be the only message.
                                        <span className="text-slate-500">Your photo</span>
                                    ) : result?.extracted?.brand || result?.extracted?.product_name ? (
                                        <>
                                            <p className="truncate font-semibold text-slate-800">
                                                {result.extracted.brand}
                                            </p>
                                            <p className="truncate text-slate-500">
                                                {result.extracted.product_name}
                                            </p>
                                        </>
                                    ) : result?.extracted?.scanned_text ? (
                                        <p className="line-clamp-2 text-slate-500" title={result.extracted.scanned_text}>
                                            Read text: {result.extracted.scanned_text}
                                        </p>
                                    ) : (
                                        <span className="text-slate-500">Nothing readable on that pack.</span>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {error ? (
                            <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>
                        ) : null}

                        {status === 'done' && result?.matched ? (
                            <>
                            {result.confident === false ? (
                                <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                                    The brand on the pack was hard to read, so these are matched on the
                                    product name alone — check it is the right one.
                                </p>
                            ) : null}
                            <ul className="space-y-2">
                                {result.matches.map((item) => (
                                    <li key={item.product_uid}>
                                        <Link
                                            href={productPath(item.product_uid)}
                                            onClick={close}
                                            className="flex items-center gap-3 rounded-2xl border border-slate-100 p-2.5 transition-colors hover:border-[#e08a7d] hover:bg-[#fdf7f5]"
                                        >
                                            {item.image ? (
                                                <Image
                                                    src={item.image}
                                                    alt={item.product_name}
                                                    width={48}
                                                    height={48}
                                                    className="h-12 w-12 shrink-0 rounded-lg object-contain"
                                                />
                                            ) : (
                                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                                    <FiImage size={18} aria-hidden="true" />
                                                </span>
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[11px] uppercase tracking-wide text-slate-400">
                                                    {item.brand_name}
                                                </span>
                                                <span className="block truncate text-[13px] font-medium text-slate-800">
                                                    {item.product_name}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            </>
                        ) : null}

                        {status === 'done' && !result?.matched ? (
                            <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center">
                                <p className="text-[13px] text-slate-600">
                                    {result?.message || 'We could not find that product in our catalogue.'}
                                </p>
                                {result?.query ? (
                                    <button
                                        type="button"
                                        onClick={searchByText}
                                        className="mt-3 rounded-full bg-[#f3a99a] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#e08a7d]"
                                    >
                                        Search for “{result.query}” instead
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        {status === 'done' || error ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setPreview('')
                                    setResult(null)
                                    setError('')
                                    setStatus('idle')
                                    setProgress(0)
                                    setPass(null)
                                }}
                                className="mt-4 w-full rounded-full border border-slate-200 py-2.5 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                Try another photo
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </>
    )
}
