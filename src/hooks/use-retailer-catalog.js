'use client'

import { useEffect, useRef, useState } from 'react'

function buildQuery({ search, filters, sort, page, profile, bands, productUids }) {
    const params = new URLSearchParams()
    // Bump when the public catalogue card shape changes so the browser does
    // not reuse a previously cached response that is missing new fields.
    params.set('schema', '2')
    if (search.trim()) params.set('search', search.trim())
    for (const productUid of productUids || []) params.append('productUid', productUid)
    for (const key of ['brand', 'category', 'site', 'price']) {
        for (const value of filters[key] || []) params.append(key, value)
    }
    if (sort) params.set('sort', sort)
    params.set('page', String(page))
    // Asks for a spread across score bands instead of one ranked page.
    if (bands) params.set('bands', String(bands))

    // The skin-match score depends entirely on the quiz answers, so they travel
    // with the request. Without a skinType the server returns the catalogue
    // unscored rather than scoring it against a profile nobody chose.
    if (profile?.selectedSkinType) {
        params.set('skinType', profile.selectedSkinType)
        params.set('sensitive', profile.selectedSensitive ? '1' : '0')
        params.set('age', profile.age || 'Adult')
        // The engine scores one concern at a time; the quiz collects a list.
        const concern = [
            ...(profile.selectedFaceBodyConcerns || []),
            ...(profile.selectedLipsEyesConcerns || []),
        ].find((item) => item && item !== 'None')
        params.set('concern', concern || 'None')
        for (const condition of profile.selectedSpecialConditions || []) {
            if (condition) params.append('condition', condition)
        }
    }
    return params.toString()
}

// The catalogue is ~13k products, far too much to hand the browser and filter
// client-side the way the scored catalogue did. Filtering, sorting, paging and
// facet counts all happen on the server; this only ever holds one page.
export function useRetailerCatalog({ search, filters, sort, page, profile, bands, productUids }) {
    const [state, setState] = useState({
        products: [],
        facets: { brand: [], category: [], site: [], price: [] },
        total: 0,
        catalogTotal: 0,
        totalPages: 1,
        scored: false,
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    // Keeps the previous page on screen while the next one loads, so the grid
    // does not collapse to empty on every keystroke.
    const loaded = useRef(false)

    const query = buildQuery({ search, filters, sort, page, profile, bands, productUids })

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
                    scored: Boolean(payload.scored),
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
