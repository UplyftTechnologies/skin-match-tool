'use client'

import { useEffect, useRef, useState } from 'react'

function buildQuery({ search, filters, sort, page }) {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    for (const key of ['brand', 'category', 'site', 'price']) {
        for (const value of filters[key] || []) params.append(key, value)
    }
    if (sort) params.set('sort', sort)
    params.set('page', String(page))
    return params.toString()
}

// The catalogue is ~13k products, far too much to hand the browser and filter
// client-side the way the scored catalogue did. Filtering, sorting, paging and
// facet counts all happen on the server; this only ever holds one page.
export function useRetailerCatalog({ search, filters, sort, page }) {
    const [state, setState] = useState({
        products: [],
        facets: { brand: [], category: [], site: [], price: [] },
        total: 0,
        catalogTotal: 0,
        totalPages: 1,
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    // Keeps the previous page on screen while the next one loads, so the grid
    // does not collapse to empty on every keystroke.
    const loaded = useRef(false)

    const query = buildQuery({ search, filters, sort, page })

    useEffect(() => {
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            try {
                if (!loaded.current) setLoading(true)
                const response = await fetch(`/api/retailer-products/catalog?${query}`, {
                    signal: controller.signal,
                })
                const payload = await response.json()
                if (!response.ok) throw new Error(payload.error || 'Unable to load products.')

                setState({
                    products: payload.products || [],
                    facets: payload.facets || { brand: [], category: [], site: [], price: [] },
                    total: payload.total || 0,
                    catalogTotal: payload.catalogTotal || 0,
                    totalPages: payload.totalPages || 1,
                })
                setError('')
                loaded.current = true
            } catch (fetchError) {
                if (fetchError.name !== 'AbortError') setError(fetchError.message)
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }, 220)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query])

    return { ...state, loading, error }
}
