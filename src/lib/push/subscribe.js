'use client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function pushSupported() {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && Boolean(VAPID_PUBLIC_KEY)
}

/** Names the missing precondition, so a silent no-prompt is diagnosable. */
function unsupportedReason() {
    if (typeof window === 'undefined') return 'not running in a browser'
    if (!('serviceWorker' in navigator)) return 'no serviceWorker support'
    if (!('PushManager' in window)) return 'no PushManager support'
    // NEXT_PUBLIC_* is inlined at BUILD time. If it was absent when the bundle
    // was built, it is undefined here no matter what the host env now says —
    // and the permission prompt never appears. Redeploy after setting it.
    if (!VAPID_PUBLIC_KEY) return 'NEXT_PUBLIC_VAPID_PUBLIC_KEY missing from the build'
    return null
}

/**
 * Ensures the browser has an active push subscription and that the server
 * knows about it. Safe to call repeatedly — it's a no-op once subscribed.
 * Must be called from a user-gesture handler the first time, since browsers
 * require that to show the permission prompt.
 */
export async function ensurePushSubscribed(visitorId) {
    const reason = unsupportedReason()
    if (reason) {
        console.warn(`[push] skipped: ${reason}`)
        return false
    }
    if (!visitorId) {
        console.warn('[push] skipped: no visitorId')
        return false
    }
    if (Notification.permission === 'denied') {
        console.warn('[push] skipped: notifications are blocked for this origin')
        return false
    }

    try {
        // Ask BEFORE registering the service worker. Awaiting the registration
        // first consumes the transient user activation, which Safari requires in
        // order to show the prompt at all; it also avoids registering a worker
        // for someone who then declines.
        let permission = Notification.permission
        if (permission === 'default') {
            permission = await Notification.requestPermission()
        }
        if (permission !== 'granted') {
            console.warn(`[push] permission not granted: ${permission}`)
            return false
        }

        const registration = await navigator.serviceWorker.register('/sw.js')
        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            })
        }

        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId, subscription: subscription.toJSON() }),
        })

        return true
    } catch (error) {
        console.warn('[push] subscribe failed:', error)
        return false
    }
}
