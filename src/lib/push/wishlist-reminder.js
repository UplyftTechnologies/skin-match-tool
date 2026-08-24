'use client'

import { getVisitorId, getSessionId } from '@/lib/tracking/identity'
import { ensurePushSubscribed } from './subscribe'


export function triggerWishlistReminder(product) {
    const visitorId = getVisitorId()
    if (!visitorId) return

    const canSubscribe = typeof Notification !== 'undefined'
        && Notification.permission === 'granted'

    const subscribe = canSubscribe
        ? ensurePushSubscribed(visitorId)
        : Promise.resolve(false)

    subscribe.finally(() => {
        fetch('/api/wishlist/schedule-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitorId,
                sessionId: getSessionId(),
                productUid: product.product_uid,
                productName: product.product_name,
            }),
        }).catch(() => {
            // Reminder scheduling is best-effort; a failed request here
            // shouldn't surface as a wishlist error to the user.
        })
    })
}
