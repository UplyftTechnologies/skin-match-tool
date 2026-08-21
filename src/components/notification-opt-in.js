'use client'

import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ensurePushSubscribed } from '@/lib/push/subscribe'
import { getVisitorId } from '@/lib/tracking/identity'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

/**
 * Requests browser notification permission immediately after sign-in.
 *
 * There is deliberately no site-designed pre-permission card: Chrome's own
 * Block / Allow dialog is the only prompt a newly logged-in visitor sees.
 */
export default function NotificationOptIn() {
    // getSession() and onAuthStateChange() can both report the same login.
    // Guarding it makes sure Chrome is asked at most once per mounted app.
    const promptedRef = useRef(false)

    const evaluate = useCallback(async (session) => {
        if (!session?.user || typeof Notification === 'undefined') return

        if (Notification.permission === 'granted') {
            ensurePushSubscribed(getVisitorId()).catch(() => {})
            return
        }

        if (Notification.permission !== 'default' || promptedRef.current) return
        promptedRef.current = true

        try {
            const permission = await Notification.requestPermission()
            trackingService.trackEvent(EVENTS.PUSH_PERMISSION_ANSWERED, {
                permission,
                source: 'post_login',
            })

            if (permission !== 'granted') return

            const subscribed = await ensurePushSubscribed(getVisitorId())
            trackingService.trackEvent(EVENTS.PUSH_SUBSCRIBED, {
                ok: subscribed,
                source: 'post_login',
            })
        } catch {
            // Permission and subscription failures must never interrupt login.
        }
    }, [])

    useEffect(() => {
        let active = true

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (active) evaluate(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (active && event === 'SIGNED_IN') evaluate(session)
        })

        return () => {
            active = false
            subscription?.unsubscribe()
        }
    }, [evaluate])

    return null
}
