'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

// Google (and any other Supabase-native OAuth provider) redirects here after
// consent. supabase-js auto-exchanges the `?code=` param for a session on
// client init — we just wait for that session, bootstrap public.users the
// same way the phone/OTP flow does, then forward to the real destination.
function hasPhone(user) {
  return Boolean(user?.phone || user?.user_metadata?.phone_no || user?.user_metadata?.phone)
}

function sanitizeRedirect(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function CompleteProfileForm({ session, redirectTo, onDone }) {
  const [name, setName] = useState(session.user.user_metadata?.full_name || session.user.user_metadata?.name || '')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Enter a valid 10-digit Indian mobile number.')
      return
    }

    setSubmitting(true)
    trackingService.trackEvent(EVENTS.CLICKED_COMPLETE_PROFILE, { method: 'google', userId: session.user.id })

    try {
      await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim(), phone: `+91${phone.trim()}` }),
      })
    } catch (err) {
      console.error('[auth/callback] sync-user failed:', err)
      trackingService.trackEvent(EVENTS.PROFILE_SYNC_FAILED, {
        method: 'google',
        userId: session.user.id,
        error: err?.message || String(err),
      })
    }

    onDone(redirectTo)
  }

  return (
    <div className="w-full max-w-[380px] rounded-2xl border border-[#eee7e3] bg-white px-6 py-8 shadow-[0_18px_55px_rgba(62,45,57,0.08)]">
      <h2 className="text-center font-lato text-sm font-semibold uppercase tracking-[0.15em] text-gray-900">
        Complete your profile
      </h2>
      <p className="mt-1 text-center text-xs text-gray-500">Just a few more details</p>

      {error ? (
        <p className="mt-4 text-center text-xs font-medium text-red-600" role="alert">{error}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5">
        <label htmlFor="profile-name" className="block text-sm text-gray-700 mb-1">
          Full name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your full name"
          disabled={submitting}
          autoFocus
          className="w-full rounded-lg border border-[#c9dedc] px-3 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#7fb3ab] transition-colors disabled:bg-gray-50 disabled:text-gray-400"
        />

        <label htmlFor="profile-phone" className="mt-4 block text-sm text-gray-700 mb-1">
          Phone number
        </label>
        <div className="flex items-center rounded-lg border border-[#c9dedc] focus-within:border-[#7fb3ab] transition-colors overflow-hidden">
          <span className="flex shrink-0 items-center border-r border-[#c9dedc] bg-[#eef7f6] px-3 py-3 text-sm font-medium text-gray-600">
            +91
          </span>
          <input
            id="profile-phone"
            type="tel"
            maxLength="10"
            placeholder="Enter 10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            disabled={submitting}
            className="min-w-0 flex-1 px-3 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !name || phone.length < 10}
          className="mt-5 min-h-11 w-full rounded-[10px] border border-[#e08a7d] px-4 py-2.5 font-lato text-sm capitalize tracking-widest text-[#e16f60] transition-colors duration-300 hover:bg-[#d17a6d] hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Complete Sign In'}
        </button>
      </form>
    </div>
  )
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error_description') || searchParams.get('error') || ''
  const [error, setError] = useState(oauthError)
  const [pendingProfile, setPendingProfile] = useState(null)

  useEffect(() => {
    const redirectTo = sanitizeRedirect(searchParams.get('redirect'))

    if (oauthError) {
      console.error('[auth/callback] OAuth provider returned an error:', oauthError)
      trackingService.trackEvent(EVENTS.GOOGLE_LOGIN_FAILED, {
        method: 'google',
        stage: 'callback',
        error: oauthError,
      })
      // /profile's "Link Google Account" started this — bounce back there
      // with the error so it renders inline instead of stranding the user
      // on a standalone error screen with nowhere obvious to go.
      if (redirectTo === '/profile') {
        router.replace(`${redirectTo}?googleError=${encodeURIComponent(oauthError)}`)
      }
      return
    }

    let cancelled = false

    const finish = async () => {
      // Give the client SDK a moment to detect + exchange the ?code= in the URL.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          if (cancelled) return

          const isNewUser = session.user?.created_at && session.user?.last_sign_in_at
            && Math.abs(new Date(session.user.last_sign_in_at) - new Date(session.user.created_at)) < 5000

          trackingService.trackEvent(
            isNewUser ? EVENTS.ACCOUNT_CREATED : EVENTS.EXISTING_USER_LOGIN,
            { userId: session.user.id, method: 'google' },
          )

          // Google never hands us a phone number, so first-time Google
          // sign-ins stop here to collect one before we sync + redirect.
          if (!hasPhone(session.user)) {
            setPendingProfile({ session, redirectTo })
            return
          }

          try {
            await fetch('/api/auth/sync-user', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
          } catch (err) {
            console.error('[auth/callback] sync-user failed:', err)
            trackingService.trackEvent(EVENTS.PROFILE_SYNC_FAILED, {
              method: 'google',
              userId: session.user.id,
              error: err?.message || String(err),
            })
          }

          router.replace(redirectTo)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      if (!cancelled) {
        setError('Sign-in did not complete. Please try again.')
      }
    }

    finish()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (pendingProfile) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-[#fffdfa] px-4">
        <CompleteProfileForm
          session={pendingProfile.session}
          redirectTo={pendingProfile.redirectTo}
          onDone={(redirectTo) => router.replace(redirectTo)}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#fffdfa] px-4">
      {error ? (
        <div className="text-center">
          <p className="text-sm font-medium text-red-600 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="text-sm font-semibold text-[#e08a7d] hover:text-[#d17a6d]"
          >
            Back to login
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Signing you in…</p>
      )}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackContent />
    </Suspense>
  )
}
