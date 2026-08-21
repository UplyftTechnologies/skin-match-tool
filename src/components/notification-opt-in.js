'use client'

import { useCallback, useEffect, useState } from 'react'
import { FiBell, FiX } from 'react-icons/fi'
import { supabase } from '@/lib/supabase/client'
import { ensurePushSubscribed } from '@/lib/push/subscribe'
import { getVisitorId } from '@/lib/tracking/identity'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

const DISMISSED_KEY = 'roopsee-push-optin-dismissed-until'
const SNOOZE_DAYS = 14
// Long enough that the login redirect has settled and the user is looking at
// real content, short enough that it still reads as part of signing in.
const APPEAR_AFTER_MS = 2500

function snoozedUntil() {
    try {
        return Number(localStorage.getItem(DISMISSED_KEY)) || 0
    } catch {
        return 0
    }
}

function snooze(days) {
    try {
        localStorage.setItem(DISMISSED_KEY, String(Date.now() + days * 86400000))
    } catch {
        // Private mode — the prompt simply reappears next session.
    }
}

/**
 * Asks logged-in users to turn on notifications.
 *
 * Deliberately a soft ask first. Calling Notification.requestPermission()
 * unprompted is how you get "Block", and a blocked origin can never ask again
 * from code — the user has to dig through site settings. A dismissible card
 * costs nothing and keeps the real prompt for people who already said yes.
 */
export default function NotificationOptIn() {
    const [visible, setVisible] = useState(false)
    const [busy, setBusy] = useState(false)
    const [failed, setFailed] = useState('')

    const evaluate = useCallback((session) => {
        if (!session?.user) return
        if (typeof Notification === 'undefined') return
        // 'granted' means we already have it; 'denied' means only the browser
        // UI can undo it, so nagging is pointless.
        if (Notification.permission !== 'default') return
        if (Date.now() < snoozedUntil()) return
        setTimeout(() => setVisible(true), APPEAR_AFTER_MS)
    }, [])

    useEffect(() => {
        let active = true

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (active) evaluate(session)
        })

        // Catches the login that just happened, since the user lands here by
        // redirect rather than by this component mounting mid-session.
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

    async function allow() {
        setBusy(true)
        setFailed('')
        try {
            // This click is the user gesture the browser requires before it
            // will show the permission prompt at all.
            const permission = await Notification.requestPermission()
            trackingService.trackEvent(EVENTS.PUSH_PERMISSION_ANSWERED, { permission, source: 'post_login' })

            if (permission !== 'granted') {
                snooze(SNOOZE_DAYS)
                setVisible(false)
                return
            }

            const subscribed = await ensurePushSubscribed(getVisitorId())
            trackingService.trackEvent(EVENTS.PUSH_SUBSCRIBED, { ok: subscribed, source: 'post_login' })
            if (!subscribed) {
                setFailed('Your browser blocked the connection to its push service. Notifications may not arrive.')
                setBusy(false)
                return
            }
            setVisible(false)
        } catch {
            setFailed('Something went wrong turning notifications on.')
            setBusy(false)
        }
    }

    function notNow() {
        snooze(SNOOZE_DAYS)
        setVisible(false)
        trackingService.trackEvent(EVENTS.PUSH_PERMISSION_ANSWERED, { permission: 'dismissed', source: 'post_login' })
    }

    if (!visible) return null

    return (
        <div className="fixed bottom-4 left-1/2 z-[9997] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-[#f0d9d3] bg-white p-4 shadow-2xl sm:bottom-6">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fdf7f5] text-[#d77465]">
                    <FiBell size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-slate-800">Turn on notifications</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                        Get price drops on products you save, and skincare tips matched to your skin.
                    </p>
                    {failed ? (
                        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11.5px] text-amber-800">{failed}</p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={allow}
                            disabled={busy}
                            className="rounded-full bg-[#f3a99a] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#e08a7d] disabled:opacity-60"
                        >
                            {busy ? 'Enabling…' : 'Allow notifications'}
                        </button>
                        <button
                            type="button"
                            onClick={notNow}
                            className="rounded-full border border-slate-200 px-4 py-2 text-[12.5px] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                        >
                            Not now
                        </button>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={notNow}
                    aria-label="Dismiss"
                    className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                    <FiX size={16} aria-hidden="true" />
                </button>
            </div>
        </div>
    )
}
