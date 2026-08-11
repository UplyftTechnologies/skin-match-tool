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

/**
 * Ensures the browser has an active push subscription and that the server
 * knows about it. Safe to call repeatedly — it's a no-op once subscribed.
 * Must be called from a user-gesture handler the first time, since browsers
 * require that to show the permission prompt.
 */
export async function ensurePushSubscribed(visitorId) {
    if (!pushSupported() || !visitorId) return false
    if (Notification.permission === 'denied') return false

    try {
        const registration = await navigator.serviceWorker.register('/sw.js')

        let permission = Notification.permission
        if (permission === 'default') {
            permission = await Notification.requestPermission()
        }
        if (permission !== 'granted') return false

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
