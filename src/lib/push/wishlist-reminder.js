'use client'

import { getVisitorId, getSessionId } from '@/lib/tracking/identity'
import { ensurePushSubscribed } from './subscribe'

/**
 * Fires on every wishlist "add". Best-effort and non-blocking for the
 * caller — wishlist state updates regardless of whether push permission is
 * granted or the network call succeeds.
 */
export function triggerWishlistReminder(product) {
    const visitorId = getVisitorId()
    if (!visitorId) return

    ensurePushSubscribed(visitorId).finally(() => {
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
