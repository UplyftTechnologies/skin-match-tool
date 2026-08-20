'use client'

import { getVisitorId } from '@/lib/tracking/identity'
import { ensurePushSubscribed } from './subscribe'

export async function setNewProductAlertsEnabled(enabled) {
    const visitorId = getVisitorId()
    if (!visitorId) return false

    if (enabled) {
        // Must land before the PATCH below — the toggle flips a flag on an
        // existing push_subscriptions row, so one has to exist first.
        await ensurePushSubscribed(visitorId)
    }

    try {
        const response = await fetch('/api/push/subscribe', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId, notifyNewProducts: enabled }),
        })
        return response.ok
    } catch (error) {
        console.warn('[new-products-alert] update failed:', error)
        return false
    }
}

export async function fetchNewProductAlertsEnabled() {
    const visitorId = getVisitorId()
    if (!visitorId) return false

    try {
        const response = await fetch(`/api/push/subscribe?visitorId=${encodeURIComponent(visitorId)}`)
        if (!response.ok) return false
        const data = await response.json().catch(() => ({}))
        return Boolean(data?.notifyNewProducts)
    } catch (error) {
        console.warn('[new-products-alert] status check failed:', error)
        return false
    }
}
