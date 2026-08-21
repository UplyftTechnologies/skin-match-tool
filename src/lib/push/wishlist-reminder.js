'use client'

import { getVisitorId, getSessionId } from '@/lib/tracking/identity'
import { ensurePushSubscribed } from './subscribe'

/**
 * Fires on every wishlist "add". Best-effort and non-blocking for the
 * caller — wishlist state updates regardless of whether push permission is
 * granted or the network call succeeds.
 *
 * Importantly, this must never open the browser's permission dialog. The
 * in-app notification card is the single, intentional place where a visitor
 * can choose to request permission. A wishlist click should only subscribe
 * when permission has already been granted.
 */
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
