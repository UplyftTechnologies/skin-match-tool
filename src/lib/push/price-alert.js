'use client'

import { getVisitorId } from '@/lib/tracking/identity'
import { ensurePushSubscribed } from './subscribe'

export async function subscribePriceDropAlert(product) {
    const visitorId = getVisitorId()
    if (!visitorId) return false

    // Best-effort: the alert still saves server-side even if the browser
    // declines the permission prompt — it just won't be able to deliver
    // anything until permission is granted later.
    await ensurePushSubscribed(visitorId)

    try {
        const response = await fetch('/api/price-alerts/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitorId,
                productUid: product.product_uid,
                productName: product.product_name,
                watchPrice: Number(product.selling_price),
            }),
        })
        return response.ok
    } catch (error) {
        console.warn('[price-alert] subscribe failed:', error)
        return false
    }
}

export async function unsubscribePriceDropAlert(product) {
    const visitorId = getVisitorId()
    if (!visitorId) return false

    try {
        const response = await fetch('/api/price-alerts/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId, productUid: product.product_uid }),
        })
        return response.ok
    } catch (error) {
        console.warn('[price-alert] unsubscribe failed:', error)
        return false
    }
}

export async function fetchPriceDropAlertStatus(productUid) {
    const visitorId = getVisitorId()
    if (!visitorId) return false

    try {
        const response = await fetch(
            `/api/price-alerts/subscribe?visitorId=${encodeURIComponent(visitorId)}&productUid=${encodeURIComponent(productUid)}`,
        )
        if (!response.ok) return false
        const data = await response.json().catch(() => ({}))
        return Boolean(data?.subscribed)
    } catch (error) {
        console.warn('[price-alert] status check failed:', error)
        return false
    }
}
